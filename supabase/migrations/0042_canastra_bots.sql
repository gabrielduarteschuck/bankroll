-- =====================================================================
-- Canastra — Bots de teste: mesa simulada + jogada automática simples
-- =====================================================================
-- Permite testar o layout sozinho: cria uma sala já cheia com 3 bots,
-- distribui e inicia. Os bots apenas compram do monte e descartam uma
-- carta aleatória (sem baixar/levar mesa/bater) — só pra manter o jogo
-- andando enquanto se testa a interface.

-- Marca jogadores controlados pela máquina
alter table public.canastra_players add column if not exists is_bot boolean not null default false;

-- ---------------------------------------------------------------------
-- Criar mesa simulada (host + 3 bots) já em andamento
-- ---------------------------------------------------------------------
create or replace function public.canastra_create_sim_room(p_token uuid)
returns table(room_code text, room_id uuid, player_id uuid)
language plpgsql security definer set search_path=public as $$
declare
  v_room_id uuid; v_code text; v_player_id uuid; v_state jsonb; v_dealer int;
begin
  v_code := canastra_gen_code();
  insert into canastra_rooms(code) values (v_code) returning id into v_room_id;

  insert into canastra_players(room_id, name, is_host)
    values (v_room_id, 'Você', true) returning id into v_player_id;
  insert into canastra_player_secrets(player_id, token) values (v_player_id, p_token);

  insert into canastra_players(room_id, name, is_bot) values
    (v_room_id, '🤖 Bot Ana',  true),
    (v_room_id, '🤖 Bot Bia',  true),
    (v_room_id, '🤖 Bot Caio', true);
  insert into canastra_player_secrets(player_id, token)
    select pl.id, gen_random_uuid() from canastra_players pl
    where pl.room_id=v_room_id and pl.is_bot;

  -- sorteia duplas e já distribui / inicia a partida
  perform canastra_draw_teams(v_room_id);
  select dealer_seat into v_dealer from canastra_rooms where id=v_room_id;
  v_state := canastra_deal(v_room_id, v_dealer, 1);
  insert into canastra_games(room_id, state, version) values (v_room_id, v_state, 1);
  update canastra_rooms set status='playing', round_no=1, updated_at=now() where id=v_room_id;

  return query select v_code, v_room_id, v_player_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Uma jogada do bot: se a vez é de um bot, compra do monte e descarta
-- uma carta aleatória, passando a vez. Retorna true se jogou.
-- Qualquer cliente da sala pode chamar (sem token) — é seguro porque o
-- bot só faz a jogada mais básica possível.
-- ---------------------------------------------------------------------
create or replace function public.canastra_bot_step(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare
  v_room canastra_rooms; v_game canastra_games; v_state jsonb;
  v_seat int; v_player canastra_players; v_team text;
  v_stock text[]; v_hand text[]; v_card text; v_next int; v_pick text; v_len int;
begin
  select * into v_room from canastra_rooms where id=p_room_id;
  if v_room.id is null or v_room.status <> 'playing' then return false; end if;
  select * into v_game from canastra_games where room_id=p_room_id for update;
  if v_game.id is null then return false; end if;
  v_state := v_game.state;
  if v_state->>'phase' = 'over' then return false; end if;

  v_seat := (v_state->>'turn_seat')::int;
  select * into v_player from canastra_players where room_id=p_room_id and seat=v_seat;
  if v_player.id is null or not coalesce(v_player.is_bot,false) then return false; end if;
  v_team := v_player.team::text;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));

  -- fase de compra: tira do monte (revela 3 vermelho automaticamente)
  if v_state->>'phase' = 'draw' then
    v_stock := array(select jsonb_array_elements_text(v_state->'stock'));
    if array_length(v_stock,1) is null then
      return false; -- monte vazio: bot não sabe encerrar, deixa pro host
    end if;
    loop
      v_card := v_stock[1]; v_stock := v_stock[2:array_length(v_stock,1)];
      if left(v_card,2) in ('3H','3D') then
        v_state := jsonb_set(v_state, array['red3',v_team], to_jsonb((v_state->'red3'->>v_team)::int + 1));
        if array_length(v_stock,1) is null then exit; end if;
      else v_hand := array_append(v_hand, v_card); exit; end if;
    end loop;
    v_state := jsonb_set(v_state, array['stock'], to_jsonb(v_stock));
    v_state := jsonb_set(v_state, array['hands', v_player.id::text], to_jsonb(v_hand));
    v_state := jsonb_set(v_state, array['phase'], to_jsonb('play'::text));
  end if;

  -- fase de jogo: descarta uma carta aleatória e passa a vez
  v_len := coalesce(array_length(v_hand,1),0);
  v_next := (v_seat % 4) + 1;
  if v_len > 0 then
    v_pick := v_hand[1 + floor(random()*v_len)::int];
    v_hand := array_remove(v_hand, v_pick);
    v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));
    v_state := jsonb_set(v_state, array['discard'], (v_state->'discard') || to_jsonb(v_pick));
  end if;
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('draw'::text));
  v_state := jsonb_set(v_state, array['turn_seat'], to_jsonb(v_next));

  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set updated_at=now() where id=p_room_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- get_view passa a expor is_bot em cada jogador (driver dos bots no front)
-- ---------------------------------------------------------------------
create or replace function public.canastra_get_view(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_players jsonb; v_discard jsonb; v_melds_out jsonb;
  t text; m jsonb; v_cards text[]; arr jsonb; v_size int; v_clean boolean;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then return null; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id;
  if v_game.id is null then return null; end if;
  v_state := v_game.state;

  select jsonb_agg(jsonb_build_object(
    'player_id',pl.id,'name',pl.name,'seat',pl.seat,'team',pl.team,'is_host',pl.is_host,
    'is_bot', pl.is_bot,
    'hand_count', coalesce(jsonb_array_length(v_state->'hands'->pl.id::text),0),
    'is_turn', pl.seat = (v_state->>'turn_seat')::int
  ) order by pl.seat) into v_players
  from canastra_players pl where pl.room_id=v_room.id;

  v_melds_out := jsonb_build_object('1','[]'::jsonb,'2','[]'::jsonb);
  for t in select unnest(array['1','2']) loop
    arr := '[]'::jsonb;
    for m in select * from jsonb_array_elements(v_state->'melds'->t) loop
      v_cards := array(select jsonb_array_elements_text(m->'cards'));
      v_size := array_length(v_cards,1);
      v_clean := not exists(select 1 from unnest(v_cards) c where substr(c,1,1)='2');
      arr := arr || jsonb_build_array(jsonb_build_object(
        'id', m->>'id', 'cards', m->'cards', 'size', v_size,
        'clean', v_clean, 'is_canastra', v_size >= 7,
        'points', canastra_meld_points(v_cards)));
    end loop;
    v_melds_out := jsonb_set(v_melds_out, array[t], arr);
  end loop;

  v_discard := v_state->'discard';
  return jsonb_build_object(
    'status', v_room.status, 'version', v_game.version, 'round', v_state->'round',
    'dealer_seat', v_room.dealer_seat, 'turn_seat', v_state->'turn_seat', 'phase', v_state->'phase',
    'target_score', v_room.target_score,
    'scores', jsonb_build_object('1', v_room.score_team1, '2', v_room.score_team2),
    'obrigada', jsonb_build_object('1', v_room.obrigada1, '2', v_room.obrigada2),
    'opened', v_state->'opened',
    'you', jsonb_build_object('player_id',v_player.id,'seat',v_player.seat,'team',v_player.team,'is_host',v_player.is_host),
    'your_hand', coalesce(v_state->'hands'->v_player.id::text,'[]'::jsonb),
    'players', coalesce(v_players,'[]'::jsonb),
    'stock_count', coalesce(jsonb_array_length(v_state->'stock'),0),
    'discard_count', coalesce(jsonb_array_length(v_discard),0),
    'discard_top', case when jsonb_array_length(v_discard)>0 then v_discard->-1 else null end,
    'discard_locked', case when jsonb_array_length(v_discard)>0 and left(v_discard->>-1,2) in ('3S','3C') then true else false end,
    'red3', v_state->'red3', 'melds', v_melds_out, 'last_round', v_state->'last_round');
end;
$$;

grant execute on function public.canastra_create_sim_room(uuid) to anon, authenticated;
grant execute on function public.canastra_bot_step(uuid)        to anon, authenticated;
