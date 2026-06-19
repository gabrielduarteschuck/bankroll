-- =====================================================================
-- Canastra — Etapa 3+: baixar, encaixar, levar a mesa, obrigada,
--                      trancar (3 preto), bater, pontuação e fim de jogo
-- =====================================================================

-- Placar acumulado e estado de obrigada por dupla
alter table public.canastra_rooms add column if not exists score_team1 int not null default 0;
alter table public.canastra_rooms add column if not exists score_team2 int not null default 0;
alter table public.canastra_rooms add column if not exists round_no    int not null default 1;
alter table public.canastra_rooms add column if not exists obrigada1   int not null default 150;
alter table public.canastra_rooms add column if not exists obrigada2   int not null default 150;

-- ---------------------------------------------------------------------
-- Valor de pontos de uma carta (cartas de jogo; 3 tratado à parte)
-- ---------------------------------------------------------------------
create or replace function public.canastra_card_value(p text)
returns int language sql immutable as $$
  select case substr(p,1,1)
    when '2' then 50
    when 'A' then 20
    when 'K' then 10 when 'Q' then 10 when 'J' then 10 when 'T' then 10 when '9' then 10
    when '8' then 5  when '7' then 5  when '6' then 5  when '5' then 5  when '4' then 5
    else 0 end;
$$;

create or replace function public.canastra_meld_points(p text[])
returns int language sql immutable as $$
  select coalesce(sum(public.canastra_card_value(c)),0) from unnest(p) c;
$$;

-- ---------------------------------------------------------------------
-- Valida um conjunto de cartas como jogo (sequência ou trinca A/4)
-- Retorna jsonb: {valid, type, suit, rank, wilds, size, clean, reason}
-- ---------------------------------------------------------------------
create or replace function public.canastra_meld_info(p_cards text[])
returns jsonb language plpgsql immutable as $$
declare
  v_ranks int[] := '{}'; v_suits text[] := '{}';
  v_wilds int := 0; c text; r text; s text; rv int;
  n int := coalesce(array_length(p_cards,1),0);
  k int; mn int; mx int;
begin
  if n < 3 then return jsonb_build_object('valid',false,'reason','mínimo 3 cartas'); end if;
  foreach c in array p_cards loop
    r := substr(c,1,1); s := substr(c,2,1);
    if r = '2' then
      v_wilds := v_wilds + 1;
    elsif r = '3' then
      return jsonb_build_object('valid',false,'reason','3 não entra em jogo');
    else
      rv := case r when '4' then 4 when '5' then 5 when '6' then 6 when '7' then 7
                   when '8' then 8 when '9' then 9 when 'T' then 10 when 'J' then 11
                   when 'Q' then 12 when 'K' then 13 when 'A' then 14 else 0 end;
      if rv = 0 then return jsonb_build_object('valid',false,'reason','carta inválida'); end if;
      v_ranks := array_append(v_ranks, rv);
      v_suits := array_append(v_suits, s);
    end if;
  end loop;

  if v_wilds > 1 then return jsonb_build_object('valid',false,'reason','máximo 1 coringa'); end if;
  k := coalesce(array_length(v_ranks,1),0);
  if k < 2 then return jsonb_build_object('valid',false,'reason','poucas cartas naturais'); end if;

  -- Trinca de iguais (apenas A ou 4)
  if (select count(distinct x) from unnest(v_ranks) x) = 1 then
    if v_ranks[1] not in (14,4) then
      return jsonb_build_object('valid',false,'reason','trinca só de Ás ou 4');
    end if;
    return jsonb_build_object('valid',true,'type','group',
      'rank', case when v_ranks[1]=14 then 'A' else '4' end,
      'suit', null, 'wilds', v_wilds, 'size', n, 'clean', v_wilds=0);
  end if;

  -- Sequência: mesmo naipe, ranks distintos, janela consecutiva de tamanho n em [4,14]
  if (select count(distinct x) from unnest(v_suits) x) <> 1 then
    return jsonb_build_object('valid',false,'reason','sequência precisa do mesmo naipe');
  end if;
  if (select count(distinct x) from unnest(v_ranks) x) <> k then
    return jsonb_build_object('valid',false,'reason','ranks repetidos');
  end if;
  select min(x), max(x) into mn, mx from unnest(v_ranks) x;
  if greatest(4, mx - n + 1) <= least(mn, 15 - n) then
    return jsonb_build_object('valid',true,'type','seq','suit',v_suits[1],
      'rank', null, 'wilds', v_wilds, 'size', n, 'clean', v_wilds=0);
  end if;
  return jsonb_build_object('valid',false,'reason','sequência inválida (buraco/limite)');
end;
$$;

-- ---------------------------------------------------------------------
-- Distribuição (usada por start_game e next_round). Retorna o state.
-- ---------------------------------------------------------------------
create or replace function public.canastra_deal(p_room_id uuid, p_dealer int, p_round int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_deck text[]; v_hands jsonb := '{}'::jsonb;
  v_red3 jsonb := jsonb_build_object('1',0,'2',0);
  v_stock text[]; v_first int; v_seat int; v_pid uuid; v_team text;
  v_hand text[]; v_card text; v_idx int; rec record; v_offset int := 0;
begin
  select array_agg(card order by random()) into v_deck
  from (select (r||s||'-'||d) card
        from unnest(array['A','2','3','4','5','6','7','8','9','T','J','Q','K']) r,
             unnest(array['S','H','D','C']) s, generate_series(0,1) d) x;

  for rec in select id from canastra_players where room_id=p_room_id order by seat loop
    v_hand  := v_deck[v_offset+1 : v_offset+13];
    v_hands := v_hands || jsonb_build_object(rec.id::text, to_jsonb(v_hand));
    v_offset := v_offset + 13;
  end loop;
  v_stock := v_deck[53 : array_length(v_deck,1)];
  v_first := (p_dealer % 4) + 1;

  for v_idx in 0..3 loop
    v_seat := ((p_dealer + v_idx) % 4) + 1;
    select id, team::text into v_pid, v_team
      from canastra_players where room_id=p_room_id and seat=v_seat;
    v_hand := array(select jsonb_array_elements_text(v_hands->v_pid::text));
    loop
      select c into v_card from unnest(v_hand) c where left(c,2) in ('3H','3D') limit 1;
      exit when v_card is null;
      v_hand := array_remove(v_hand, v_card);
      v_red3 := jsonb_set(v_red3, array[v_team], to_jsonb((v_red3->>v_team)::int + 1));
      loop
        v_card := v_stock[1]; v_stock := v_stock[2 : array_length(v_stock,1)];
        if left(v_card,2) in ('3H','3D') then
          v_red3 := jsonb_set(v_red3, array[v_team], to_jsonb((v_red3->>v_team)::int + 1));
        else v_hand := array_append(v_hand, v_card); exit; end if;
      end loop;
      v_card := null;
    end loop;
    v_hands := jsonb_set(v_hands, array[v_pid::text], to_jsonb(v_hand));
  end loop;

  return jsonb_build_object(
    'stock', to_jsonb(v_stock), 'discard','[]'::jsonb, 'hands', v_hands,
    'melds', jsonb_build_object('1','[]'::jsonb,'2','[]'::jsonb),
    'red3', v_red3, 'turn_seat', v_first, 'phase','draw', 'round', p_round,
    'opened', jsonb_build_object('1',false,'2',false), 'meld_seq', 0, 'last_round', null);
end;
$$;

-- ---------------------------------------------------------------------
-- Iniciar partida (host)
-- ---------------------------------------------------------------------
create or replace function public.canastra_start_game(p_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_player canastra_players; v_room canastra_rooms; v_state jsonb;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id for update;
  if v_room.status<>'lobby' then raise exception 'Partida já iniciada'; end if;
  if not v_player.is_host then raise exception 'Apenas o anfitrião inicia'; end if;
  if (select count(*) from canastra_players where room_id=v_room.id and seat is not null)<>4 then
    raise exception 'Mesa incompleta'; end if;

  v_state := canastra_deal(v_room.id, v_room.dealer_seat, 1);
  insert into canastra_games(room_id, state, version) values (v_room.id, v_state, 1)
    on conflict (room_id) do update set state=excluded.state, version=1, updated_at=now();
  update canastra_rooms set status='playing', round_no=1, updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Helper interno: carrega jogador+sala+jogo (FOR UPDATE) e valida turno
-- ---------------------------------------------------------------------
-- (inline nas funções abaixo para simplicidade)

-- ---------------------------------------------------------------------
-- Comprar do monte (revela 3 vermelho automaticamente)
-- ---------------------------------------------------------------------
create or replace function public.canastra_draw(p_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_stock text[]; v_card text; v_hand text[]; v_team text;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state; v_team := v_player.team::text;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'draw' then raise exception 'Você já comprou'; end if;

  v_stock := array(select jsonb_array_elements_text(v_state->'stock'));
  if array_length(v_stock,1) is null then raise exception 'Monte vazio'; end if;
  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  loop
    v_card := v_stock[1]; v_stock := v_stock[2 : array_length(v_stock,1)];
    if left(v_card,2) in ('3H','3D') then
      v_state := jsonb_set(v_state, array['red3',v_team], to_jsonb((v_state->'red3'->>v_team)::int + 1));
      if array_length(v_stock,1) is null then exit; end if;
    else v_hand := array_append(v_hand, v_card); exit; end if;
  end loop;

  v_state := jsonb_set(v_state, array['stock'], to_jsonb(v_stock));
  v_state := jsonb_set(v_state, array['hands', v_player.id::text], to_jsonb(v_hand));
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('play'::text));
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Baixar um jogo novo
-- ---------------------------------------------------------------------
create or replace function public.canastra_meld(p_token uuid, p_cards text[])
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_info jsonb; v_team text; c text;
  v_opened boolean; v_score int; v_obr int; v_pts int; v_seq int; v_meld jsonb;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state; v_team := v_player.team::text;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'play' then raise exception 'Compre antes de baixar'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  if (select count(distinct x) from unnest(p_cards) x) <> array_length(p_cards,1) then
    raise exception 'Cartas repetidas no pedido'; end if;
  foreach c in array p_cards loop
    if not (c = any(v_hand)) then raise exception 'Carta % não está na sua mão', c; end if;
  end loop;

  v_info := canastra_meld_info(p_cards);
  if not (v_info->>'valid')::boolean then raise exception 'Jogo inválido: %', v_info->>'reason'; end if;

  v_opened := coalesce((v_state->'opened'->>v_team)::boolean,false);
  v_score := case when v_team='1' then v_room.score_team1 else v_room.score_team2 end;
  v_obr   := case when v_team='1' then v_room.obrigada1 else v_room.obrigada2 end;
  if not v_opened and v_score >= 2000 then
    v_pts := canastra_meld_points(p_cards);
    if v_pts < v_obr then
      raise exception 'Obrigada: a 1ª baixada precisa de % pontos (esta tem %)', v_obr, v_pts;
    end if;
  end if;

  foreach c in array p_cards loop v_hand := array_remove(v_hand, c); end loop;
  v_seq := coalesce((v_state->>'meld_seq')::int,0) + 1;
  v_meld := jsonb_build_object('id','m'||v_seq,'cards',to_jsonb(p_cards));
  v_state := jsonb_set(v_state, array['meld_seq'], to_jsonb(v_seq));
  v_state := jsonb_set(v_state, array['melds',v_team], (v_state->'melds'->v_team) || jsonb_build_array(v_meld));
  v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));

  -- saiu da obrigada com sucesso -> marca aberto e zera obrigada
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
-- Encaixar cartas num jogo já baixado da dupla
-- ---------------------------------------------------------------------
create or replace function public.canastra_add(p_token uuid, p_meld_id text, p_cards text[])
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_team text; c text; v_melds jsonb;
  v_idx int := -1; i int; v_existing text[]; v_combined text[]; v_info jsonb;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state; v_team := v_player.team::text;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'play' then raise exception 'Compre antes de jogar'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  foreach c in array p_cards loop
    if not (c = any(v_hand)) then raise exception 'Carta % não está na sua mão', c; end if;
  end loop;

  v_melds := v_state->'melds'->v_team;
  for i in 0 .. coalesce(jsonb_array_length(v_melds),0)-1 loop
    if v_melds->i->>'id' = p_meld_id then v_idx := i; exit; end if;
  end loop;
  if v_idx < 0 then raise exception 'Jogo não encontrado na sua dupla'; end if;

  v_existing := array(select jsonb_array_elements_text(v_melds->v_idx->'cards'));
  v_combined := v_existing || p_cards;
  v_info := canastra_meld_info(v_combined);
  if not (v_info->>'valid')::boolean then raise exception 'Não encaixa: %', v_info->>'reason'; end if;

  foreach c in array p_cards loop v_hand := array_remove(v_hand, c); end loop;
  v_melds := jsonb_set(v_melds, array[v_idx::text,'cards'], to_jsonb(v_combined));
  v_state := jsonb_set(v_state, array['melds',v_team], v_melds);
  v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Levar a mesa (pegar o monte). p_mode: 'new' (jogo novo com o topo) ou
-- 'add' (encaixa o topo num jogo da dupla). p_cards = cartas do jogo novo
-- (inclui o topo). p_meld_id = jogo alvo no modo 'add'.
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
  if left(v_top,2) in ('3S','3C') then raise exception 'Mesa trancada (3 preto no topo)'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  v_opened := coalesce((v_state->'opened'->>v_team)::boolean,false);
  v_score := case when v_team='1' then v_room.score_team1 else v_room.score_team2 end;
  v_obr   := case when v_team='1' then v_room.obrigada1 else v_room.obrigada2 end;

  if p_mode = 'new' then
    if not (v_top = any(p_cards)) then raise exception 'A carta do topo precisa estar no jogo'; end if;
    -- cartas do jogo (exceto topo) precisam estar na mão
    foreach c in array p_cards loop
      if c <> v_top and not (c = any(v_hand)) then raise exception 'Carta % não está na sua mão', c; end if;
    end loop;
    v_info := canastra_meld_info(p_cards);
    if not (v_info->>'valid')::boolean then raise exception 'Jogo inválido: %', v_info->>'reason'; end if;
    v_pts := canastra_meld_points(p_cards);

    -- Obrigada: se não atinge o alvo, devolve tudo e sobe +30 (falha)
    if not v_opened and v_score >= 2000 and v_pts < v_obr then
      if v_team='1' then update canastra_rooms set obrigada1=obrigada1+30 where id=v_room.id;
      else update canastra_rooms set obrigada2=obrigada2+30 where id=v_room.id; end if;
      -- compra do monte no lugar (turno segue), revelando 3 vermelho
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

    -- Sucesso: pega o monte, baixa o jogo
    v_hand := v_hand || array(select c2 from unnest(v_pile) c2 where c2 <> v_top);  -- resto do monte vai pra mão
    -- (o topo é consumido pelo jogo; demais cartas do jogo saem da mão)
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

  -- sucesso comum: limpa o monte, atualiza mão/abertura/obrigada, fase play
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
-- Descartar (passa a vez). 3 preto no topo trancará a mesa p/ o próximo.
-- ---------------------------------------------------------------------
create or replace function public.canastra_discard(p_token uuid, p_card text)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_next int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  v_state := v_game.state;
  if (v_state->>'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state->>'phase' <> 'play' then raise exception 'Compre antes de descartar'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state->'hands'->v_player.id::text));
  if not (p_card = any(v_hand)) then raise exception 'Carta não está na sua mão'; end if;
  if array_length(v_hand,1) = 1 then raise exception 'Última carta: use Bater para encerrar'; end if;

  v_hand := array_remove(v_hand, p_card);
  v_next := (v_player.seat % 4) + 1;
  v_state := jsonb_set(v_state, array['hands',v_player.id::text], to_jsonb(v_hand));
  v_state := jsonb_set(v_state, array['discard'], (v_state->'discard') || to_jsonb(p_card));
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('draw'::text));
  v_state := jsonb_set(v_state, array['turn_seat'], to_jsonb(v_next));
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Bater: encerra a rodada (mão vazia + dupla com canastra). p_card =
-- descarte final opcional (se ainda houver 1 carta).
-- ---------------------------------------------------------------------
create or replace function public.canastra_bate(p_token uuid, p_card text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_has_canastra boolean; v_team text;
  t text; m jsonb; v_cards text[]; v_pts int; v_bonus int; v_clean boolean;
  v_size int; v_red3 int; v_hpen int; v_total int; v_break jsonb := '{}'::jsonb;
  v_bater_team int; rec record; hp int; v_new1 int; v_new2 int; v_target int;
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

  -- dupla precisa de ao menos 1 canastra (jogo com 7+ cartas)
  v_has_canastra := false;
  for m in select * from jsonb_array_elements(v_state->'melds'->v_team) loop
    if jsonb_array_length(m->'cards') >= 7 then v_has_canastra := true; end if;
  end loop;
  if not v_has_canastra then raise exception 'Para bater, a dupla precisa de ao menos uma canastra'; end if;

  v_state := jsonb_set(v_state, array['hands',v_player.id::text], '[]'::jsonb);

  -- pontuação por dupla
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
    -- penalidade de cartas na mão (apenas dupla que não bateu)
    v_hpen := 0;
    if t <> v_team then
      for rec in select pl.id from canastra_players pl where pl.room_id=v_room.id and pl.team::text=t loop
        for hp in select 1 from jsonb_array_elements_text(v_state->'hands'->rec.id::text) loop null; end loop;
        v_hpen := v_hpen + coalesce((
          select sum(case when left(c,2) in ('3S','3C') then 100 else canastra_card_value(c) end)
          from jsonb_array_elements_text(v_state->'hands'->rec.id::text) c), 0);
      end loop;
    end if;
    v_total := v_pts + v_bonus + v_red3 + (case when t=v_team then 100 else 0 end) - v_hpen;
    v_break := v_break || jsonb_build_object(t, jsonb_build_object(
      'melds', v_pts, 'canastras', v_bonus, 'red3', v_red3,
      'bater', case when t=v_team then 100 else 0 end, 'penalidade', v_hpen, 'total', v_total));
  end loop;

  v_new1 := v_room.score_team1 + (v_break->'1'->>'total')::int;
  v_new2 := v_room.score_team2 + (v_break->'2'->>'total')::int;
  v_target := v_room.target_score;

  v_state := jsonb_set(v_state, array['phase'], to_jsonb('over'::text));
  v_state := jsonb_set(v_state, array['last_round'], jsonb_build_object(
    'bater_team', v_bater_team, 'bater_player', v_player.id, 'breakdown', v_break,
    'score_after', jsonb_build_object('1', v_new1, '2', v_new2)));

  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set score_team1=v_new1, score_team2=v_new2,
    status = case when greatest(v_new1,v_new2) >= v_target then 'finished' else 'playing' end,
    updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Próxima rodada (host): redistribui, dealer passa adiante
-- ---------------------------------------------------------------------
create or replace function public.canastra_next_round(p_token uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_new_dealer int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  if not v_player.is_host then raise exception 'Apenas o anfitrião inicia a rodada'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id for update;
  if v_room.status <> 'playing' then raise exception 'Partida não está em andamento'; end if;
  select * into v_game from canastra_games where room_id=v_room.id for update;
  if v_game.state->>'phase' <> 'over' then raise exception 'A rodada ainda não terminou'; end if;

  v_new_dealer := (v_room.dealer_seat % 4) + 1;
  v_state := canastra_deal(v_room.id, v_new_dealer, v_room.round_no + 1);
  update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
  update canastra_rooms set dealer_seat=v_new_dealer, round_no=round_no+1, updated_at=now() where id=v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Visão redigida (substitui a da Etapa 2): inclui jogos, placar, fase
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

grant execute on function public.canastra_start_game(uuid)            to anon, authenticated;
grant execute on function public.canastra_get_view(uuid)              to anon, authenticated;
grant execute on function public.canastra_draw(uuid)                  to anon, authenticated;
grant execute on function public.canastra_discard(uuid, text)         to anon, authenticated;
grant execute on function public.canastra_meld(uuid, text[])          to anon, authenticated;
grant execute on function public.canastra_add(uuid, text, text[])     to anon, authenticated;
grant execute on function public.canastra_take_pile(uuid, text, text[], text) to anon, authenticated;
grant execute on function public.canastra_bate(uuid, text)            to anon, authenticated;
grant execute on function public.canastra_next_round(uuid)            to anon, authenticated;
