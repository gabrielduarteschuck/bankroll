-- =====================================================================
-- Canastra — ajustes de regra:
--  1) Coringa (2) também tranca a mesa (como o 3 preto)
--  2) Ao bater, a dupla CAPTURA as cartas da mão adversária (soma p/ si)
--  3) Fim por monte esgotado: encerra a rodada, mãos vão pro morto (penalidade)
-- =====================================================================

-- topo que tranca a mesa: 3 preto OU coringa
create or replace function public.canastra_blocks_pile(p text)
returns boolean language sql immutable as $$
  select substr(p,1,1) = '2' or left(p,2) in ('3S','3C');
$$;

-- ---------------------------------------------------------------------
-- Levar a mesa (recriada): usa canastra_blocks_pile no topo
-- ---------------------------------------------------------------------
create or replace function public.canastra_take_pile(p_token uuid, p_mode text, p_cards text[], p_meld_id text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_team text; v_pile text[]; v_top text; v_hand text[];
  v_info jsonb; v_opened boolean; v_score int; v_obr int; v_pts int;
  c text; v_seq int; v_meld jsonb; v_melds jsonb; v_idx int := -1; i int;
  v_existing text[]; v_combined text[]; v_stock text[]; v_card text;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state; v_team := v_player.team::text;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'draw' then raise exception 'Você já jogou neste turno'; end if;

  v_pile := array(select jsonb_array_elements_text(v_state->'discard'));
  if array_length(v_pile,1) is null then raise exception 'Monte de descarte vazio'; end if;
  v_top := v_pile[array_length(v_pile,1)];
  if canastra_blocks_pile(v_top) then raise exception 'Mesa trancada (3 preto ou coringa no topo)'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  v_opened := coalesce((v_state->'opened'->>v_team)::boolean,false);
  v_score := case when v_team='1' then v_room.score_team1 else v_room.score_team2 end;
  v_obr   := case when v_team='1' then v_room.obrigada1 else v_room.obrigada2 end;

  if p_mode = 'new' then
    if not (v_top = any(p_cards)) then raise exception 'A carta do topo precisa estar no jogo'; end if;
    foreach c in array p_cards loop
      if c <> v_top and not (c = any(v_hand)) then raise exception 'Carta % não está na sua mão', c; end if;
    end loop;
    v_info := canastra_meld_info(p_cards);
    if not (v_info->>'valid')::boolean then raise exception 'Jogo inválido: %', v_info->>'reason'; end if;
    v_pts := canastra_meld_points(p_cards);

    if not v_opened and v_score >= 2000 and v_pts < v_obr then
      if v_team='1' then update canastra_rooms set obrigada1=obrigada1+30 where id=v_room.id;
      else update canastra_rooms set obrigada2=obrigada2+30 where id=v_room.id; end if;
      v_stock := array(select jsonb_array_elements_text(v_state->'stock'));
      if array_length(v_stock,1) is not null then
        loop
          v_card := v_stock[1]; v_stock := v_stock[2:array_length(v_stock,1)];
          if left(v_card,2) in ('3H','3D') then
            v_state := jsonb_set(v_state, array['red3',v_team], to_jsonb((v_state->'red3'->>v_team)::int + 1));
            if array_length(v_stock,1) is null then exit; end if;
          else v_hand := array_append(v_hand, v_card); exit; end if;
        end loop;
        v_state := jsonb_set(v_state, array['stock'], to_jsonb(v_stock));
        v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));
      end if;
      v_state := jsonb_set(v_state, array['phase'], to_jsonb('play'::text));
      update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
      update canastra_rooms set updated_at=now() where id=v_room.id;
      return;
    end if;

    v_hand := v_hand || array(select c2 from unnest(v_pile) c2 where c2 <> v_top);
    foreach c in array p_cards loop
      if c <> v_top then v_hand := array_remove(v_hand, c); end if;
    end loop;
    v_seq := coalesce((v_state->>'meld_seq')::int,0) + 1;
    v_meld := jsonb_build_object('id','m'||v_seq,'cards',to_jsonb(p_cards));
    v_state := jsonb_set(v_state, array['meld_seq'], to_jsonb(v_seq));
    v_state := jsonb_set(v_state, array['melds',v_team], (v_state->'melds'->v_team) || jsonb_build_array(v_meld));

  elsif p_mode = 'add' then
    if not v_opened then raise exception 'Para encaixar o topo a dupla já precisa ter jogo na mesa'; end if;
    v_melds := v_state->'melds'->v_team;
    for i in 0 .. coalesce(jsonb_array_length(v_melds),0)-1 loop
      if v_melds->i->>'id' = p_meld_id then v_idx := i; exit; end if;
    end loop;
    if v_idx < 0 then raise exception 'Jogo não encontrado na sua dupla'; end if;
    v_existing := array(select jsonb_array_elements_text(v_melds->v_idx->'cards'));
    v_combined := v_existing || array[v_top];
    v_info := canastra_meld_info(v_combined);
    if not (v_info->>'valid')::boolean then raise exception 'O topo não encaixa: %', v_info->>'reason'; end if;
    v_hand := v_hand || array(select c2 from unnest(v_pile) c2 where c2 <> v_top);
    v_melds := jsonb_set(v_melds, array[v_idx::text,'cards'], to_jsonb(v_combined));
    v_state := jsonb_set(v_state, array['melds',v_team], v_melds);
  else
    raise exception 'Modo inválido';
  end if;

  v_state := jsonb_set(v_state, array['discard'], '[]'::jsonb);
  v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('play'::text));
  if not v_opened then
    v_state := jsonb_set(v_state, array['opened',v_team], 'true'::jsonb);
    if v_score >= 2000 then
      if v_team='1' then update canastra_rooms set obrigada1=150 where id=v_room.id;
      else update canastra_rooms set obrigada2=150 where id=v_room.id; end if;
    end if;
  end if;
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Bater (recriada): captura as cartas da mão adversária somando p/ si.
-- Adversário só perde -100 por 3 preto na mão; demais cartas são capturadas.
-- ---------------------------------------------------------------------
create or replace function public.canastra_bate(p_token uuid, p_card text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_has_canastra boolean; v_team text;
  t text; m jsonb; v_cards text[]; v_pts int; v_bonus int; v_clean boolean;
  v_size int; v_red3 int; v_total int; v_break jsonb := '{}'::jsonb;
  v_bater_team int; v_capture int; v_losepen int; v_new1 int; v_new2 int; v_target int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state; v_team := v_player.team::text; v_bater_team := v_player.team;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'play' then raise exception 'Compre antes de bater'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  if p_card is not null then
    if not (p_card = any(v_hand)) then raise exception 'Carta de descarte não está na mão'; end if;
    v_hand := array_remove(v_hand, p_card);
    v_state := jsonb_set(v_state, array['discard'], (v_state->'discard') || to_jsonb(p_card));
  end if;
  if coalesce(array_length(v_hand,1),0) <> 0 then
    raise exception 'Para bater, baixe/descarte todas as cartas (faltam %)', array_length(v_hand,1);
  end if;

  v_has_canastra := false;
  for m in select * from jsonb_array_elements(v_state->'melds'->v_team) loop
    if jsonb_array_length(m->'cards') >= 7 then v_has_canastra := true; end if;
  end loop;
  if not v_has_canastra then raise exception 'Para bater, a dupla precisa de ao menos uma canastra'; end if;

  v_state := jsonb_set(v_state, array['hands',v_player.id::text], '[]'::jsonb);

  -- captura: soma do valor das cartas da mão adversária (3 vale 0); -100 por 3 preto
  v_capture := coalesce((select sum(canastra_card_value(c))
     from canastra_players pl, jsonb_array_elements_text(v_state->'hands'->pl.id::text) c
     where pl.room_id=v_room.id and pl.team <> v_bater_team), 0);
  v_losepen := coalesce((select count(*)*100
     from canastra_players pl, jsonb_array_elements_text(v_state->'hands'->pl.id::text) c
     where pl.room_id=v_room.id and pl.team <> v_bater_team and left(c,2) in ('3S','3C')), 0);

  for t in select unnest(array['1','2']) loop
    v_pts := 0; v_bonus := 0;
    for m in select * from jsonb_array_elements(v_state->'melds'->t) loop
      v_cards := array(select jsonb_array_elements_text(m->'cards'));
      v_pts := v_pts + canastra_meld_points(v_cards);
      v_size := array_length(v_cards,1);
      if v_size >= 7 then
        v_clean := not exists(select 1 from unnest(v_cards) c where substr(c,1,1)='2');
        if v_clean then v_bonus := v_bonus + 200 + 100*(v_size-7);
        else v_bonus := v_bonus + 100; end if;
      end if;
    end loop;
    v_red3 := (v_state->'red3'->>t)::int * 100;
    if t = v_team then
      v_total := v_pts + v_bonus + v_red3 + 100 + v_capture;
      v_break := v_break || jsonb_build_object(t, jsonb_build_object(
        'melds',v_pts,'canastras',v_bonus,'red3',v_red3,'bater',100,'captura',v_capture,'total',v_total));
    else
      v_total := v_pts + v_bonus + v_red3 - v_losepen;
      v_break := v_break || jsonb_build_object(t, jsonb_build_object(
        'melds',v_pts,'canastras',v_bonus,'red3',v_red3,'bater',0,'penalidade',v_losepen,'total',v_total));
    end if;
  end loop;

  v_new1 := v_room.score_team1 + (v_break->'1'->>'total')::int;
  v_new2 := v_room.score_team2 + (v_break->'2'->>'total')::int;
  v_target := v_room.target_score;
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('over'::text));
  v_state := jsonb_set(v_state, array['last_round'], jsonb_build_object(
    'bater_team', v_bater_team, 'reason','bate', 'breakdown', v_break,
    'score_after', jsonb_build_object('1', v_new1, '2', v_new2)));
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set score_team1=v_new1, score_team2=v_new2,
    status = case when greatest(v_new1,v_new2) >= v_target then 'finished' else 'playing' end,
    updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Encerrar rodada por monte esgotado (morto): sem bater, mãos = penalidade
-- ---------------------------------------------------------------------
create or replace function public.canastra_end_round(p_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; t text; m jsonb; v_cards text[]; v_pts int; v_bonus int;
  v_clean boolean; v_size int; v_red3 int; v_pen int; v_total int;
  v_break jsonb := '{}'::jsonb; v_new1 int; v_new2 int; v_target int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'draw' then raise exception 'Só ao iniciar o turno'; end if;
  if coalesce(jsonb_array_length(v_state->'stock'),0) <> 0 then
    raise exception 'Ainda há cartas no monte de compra';
  end if;

  for t in select unnest(array['1','2']) loop
    v_pts := 0; v_bonus := 0;
    for m in select * from jsonb_array_elements(v_state->'melds'->t) loop
      v_cards := array(select jsonb_array_elements_text(m->'cards'));
      v_pts := v_pts + canastra_meld_points(v_cards);
      v_size := array_length(v_cards,1);
      if v_size >= 7 then
        v_clean := not exists(select 1 from unnest(v_cards) c where substr(c,1,1)='2');
        if v_clean then v_bonus := v_bonus + 200 + 100*(v_size-7);
        else v_bonus := v_bonus + 100; end if;
      end if;
    end loop;
    v_red3 := (v_state->'red3'->>t)::int * 100;
    -- penalidade: todas as cartas da mão (3 preto -100, demais valor de face)
    v_pen := coalesce((select sum(case when left(c,2) in ('3S','3C') then 100 else canastra_card_value(c) end)
       from canastra_players pl, jsonb_array_elements_text(v_state->'hands'->pl.id::text) c
       where pl.room_id=v_room.id and pl.team::text=t), 0);
    v_total := v_pts + v_bonus + v_red3 - v_pen;
    v_break := v_break || jsonb_build_object(t, jsonb_build_object(
      'melds',v_pts,'canastras',v_bonus,'red3',v_red3,'bater',0,'penalidade',v_pen,'total',v_total));
  end loop;

  v_new1 := v_room.score_team1 + (v_break->'1'->>'total')::int;
  v_new2 := v_room.score_team2 + (v_break->'2'->>'total')::int;
  v_target := v_room.target_score;
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('over'::text));
  v_state := jsonb_set(v_state, array['last_round'], jsonb_build_object(
    'bater_team', 0, 'reason','morto', 'breakdown', v_break,
    'score_after', jsonb_build_object('1', v_new1, '2', v_new2)));
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set score_team1=v_new1, score_team2=v_new2,
    status = case when greatest(v_new1,v_new2) >= v_target then 'finished' else 'playing' end,
    updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- get_view (recriada): discard_locked usa canastra_blocks_pile
-- ---------------------------------------------------------------------
create or replace function public.canastra_get_view(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_players jsonb; v_discard jsonb; v_melds_out jsonb;
  t text; m jsonb; v_cards text[]; arr jsonb; v_size int; v_clean boolean; v_top text;
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
        'clean', v_clean, 'is_canastra', v_size >= 7, 'points', canastra_meld_points(v_cards)));
    end loop;
    v_melds_out := jsonb_set(v_melds_out, array[t], arr);
  end loop;

  v_discard := v_state->'discard';
  v_top := case when jsonb_array_length(v_discard) > 0 then v_discard->>-1 else null end;
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
    'discard_top', case when v_top is not null then to_jsonb(v_top) else null end,
    'discard_locked', case when v_top is not null then canastra_blocks_pile(v_top) else false end,
    'red3', v_state->'red3', 'melds', v_melds_out, 'last_round', v_state->'last_round');
end;
$$;

grant execute on function public.canastra_end_round(uuid) to anon, authenticated;
