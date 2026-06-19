-- =====================================================================
-- Canastra — Etapa 2: Baralho, distribuição e loop básico de turno
-- =====================================================================
-- O estado do jogo (incl. mãos de TODOS) vive em canastra_games.state,
-- SEM leitura pública. Clientes NUNCA leem essa tabela direto: pegam uma
-- visão redigida (só a própria mão) via RPC canastra_get_view(token).
-- Realtime é sinalizado por updates em canastra_rooms (já público).

-- Codificação das cartas: <rank><suit>-<deck>
--   rank: A 2 3 4 5 6 7 8 9 T J Q K   (T = 10, todos com 1 char)
--   suit: S(♠) H(♥) D(♦) C(♣)
--   deck: 0 ou 1 (2 baralhos) -> id único por carta (104 no total)
-- 3 vermelho = 3H / 3D ; 3 preto = 3S / 3C ; coringa = 2x

create table if not exists public.canastra_games (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null unique references public.canastra_rooms(id) on delete cascade,
  state      jsonb not null,
  version    int not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.canastra_games enable row level security;
-- Sem policy de SELECT => anon/authenticated NÃO leem (contém as mãos).
revoke all on public.canastra_games from anon, authenticated;

-- ---------------------------------------------------------------------
-- Iniciar partida: embaralha, distribui 13, trata 3 vermelhos, define turno
-- ---------------------------------------------------------------------
create or replace function public.canastra_start_game(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player canastra_players;
  v_room   canastra_rooms;
  v_deck   text[];
  v_hands  jsonb := '{}'::jsonb;
  v_red3   jsonb := jsonb_build_object('1', 0, '2', 0);
  v_stock  text[];
  v_first  int;
  v_seat   int;
  v_pid    uuid;
  v_team   text;
  v_hand   text[];
  v_card   text;
  v_idx    int;
  rec      record;
  v_offset int;
begin
  select pl.* into v_player
  from canastra_player_secrets s
  join canastra_players pl on pl.id = s.player_id
  where s.token = p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;

  select * into v_room from canastra_rooms where id = v_player.room_id for update;
  if v_room.status <> 'lobby' then raise exception 'Partida já iniciada'; end if;
  if not v_player.is_host then raise exception 'Apenas o anfitrião inicia'; end if;
  if (select count(*) from canastra_players where room_id = v_room.id and seat is not null) <> 4 then
    raise exception 'Mesa incompleta';
  end if;

  -- 104 cartas embaralhadas (shuffle uniforme — mais justo que embaralho manual)
  select array_agg(card order by random()) into v_deck
  from (
    select (r || s || '-' || d) as card
    from unnest(array['A','2','3','4','5','6','7','8','9','T','J','Q','K']) r,
         unnest(array['S','H','D','C']) s,
         generate_series(0, 1) d
  ) x;

  -- distribui 13 por jogador (ordem de assento)
  v_offset := 0;
  for rec in select id from canastra_players where room_id = v_room.id order by seat loop
    v_hand  := v_deck[v_offset + 1 : v_offset + 13];
    v_hands := v_hands || jsonb_build_object(rec.id::text, to_jsonb(v_hand));
    v_offset := v_offset + 13;
  end loop;
  v_stock := v_deck[53 : array_length(v_deck, 1)];  -- 52 restantes no monte

  -- primeiro a jogar = à direita de quem embaralhou (dealer)
  v_first := (v_room.dealer_seat % 4) + 1;

  -- 3 vermelhos: revela e repõe, na ordem de jogo a partir do primeiro
  for v_idx in 0..3 loop
    v_seat := ((v_room.dealer_seat + v_idx) % 4) + 1;
    select id, team::text into v_pid, v_team
    from canastra_players where room_id = v_room.id and seat = v_seat;
    v_hand := array(select jsonb_array_elements_text(v_hands -> v_pid::text));

    loop
      select c into v_card from unnest(v_hand) c where left(c, 2) in ('3H', '3D') limit 1;
      exit when v_card is null;
      v_hand := array_remove(v_hand, v_card);
      v_red3 := jsonb_set(v_red3, array[v_team], to_jsonb((v_red3 ->> v_team)::int + 1));
      -- compra reposição; se vier outro 3 vermelho, conta e compra de novo
      loop
        v_card  := v_stock[1];
        v_stock := v_stock[2 : array_length(v_stock, 1)];
        if left(v_card, 2) in ('3H', '3D') then
          v_red3 := jsonb_set(v_red3, array[v_team], to_jsonb((v_red3 ->> v_team)::int + 1));
        else
          v_hand := array_append(v_hand, v_card);
          exit;
        end if;
      end loop;
      v_card := null;
    end loop;

    v_hands := jsonb_set(v_hands, array[v_pid::text], to_jsonb(v_hand));
  end loop;

  insert into canastra_games(room_id, state, version)
  values (v_room.id, jsonb_build_object(
    'stock',     to_jsonb(v_stock),
    'discard',   '[]'::jsonb,
    'hands',     v_hands,
    'melds',     jsonb_build_object('1', '[]'::jsonb, '2', '[]'::jsonb),
    'red3',      v_red3,
    'turn_seat', v_first,
    'phase',     'draw',
    'round',     1
  ), 1)
  on conflict (room_id) do update
    set state = excluded.state, version = 1, updated_at = now();

  update canastra_rooms set status = 'playing', updated_at = now() where id = v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Visão redigida do jogador (só a própria mão)
-- ---------------------------------------------------------------------
create or replace function public.canastra_get_view(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player  canastra_players;
  v_room    canastra_rooms;
  v_game    canastra_games;
  v_state   jsonb;
  v_players jsonb;
  v_discard jsonb;
begin
  select pl.* into v_player
  from canastra_player_secrets s
  join canastra_players pl on pl.id = s.player_id
  where s.token = p_token;
  if v_player.id is null then return null; end if;

  select * into v_room from canastra_rooms where id = v_player.room_id;
  select * into v_game from canastra_games where room_id = v_room.id;
  if v_game.id is null then return null; end if;
  v_state := v_game.state;

  select jsonb_agg(jsonb_build_object(
    'player_id',  pl.id,
    'name',       pl.name,
    'seat',       pl.seat,
    'team',       pl.team,
    'is_host',    pl.is_host,
    'hand_count', coalesce(jsonb_array_length(v_state -> 'hands' -> pl.id::text), 0),
    'is_turn',    pl.seat = (v_state ->> 'turn_seat')::int
  ) order by pl.seat) into v_players
  from canastra_players pl where pl.room_id = v_room.id;

  v_discard := v_state -> 'discard';

  return jsonb_build_object(
    'status',        v_room.status,
    'version',       v_game.version,
    'round',         v_state -> 'round',
    'dealer_seat',   v_room.dealer_seat,
    'turn_seat',     v_state -> 'turn_seat',
    'phase',         v_state -> 'phase',
    'you',           jsonb_build_object('player_id', v_player.id, 'seat', v_player.seat, 'team', v_player.team, 'is_host', v_player.is_host),
    'your_hand',     coalesce(v_state -> 'hands' -> v_player.id::text, '[]'::jsonb),
    'players',       coalesce(v_players, '[]'::jsonb),
    'stock_count',   coalesce(jsonb_array_length(v_state -> 'stock'), 0),
    'discard_count', coalesce(jsonb_array_length(v_discard), 0),
    'discard_top',   case when jsonb_array_length(v_discard) > 0 then v_discard -> -1 else null end,
    'red3',          v_state -> 'red3',
    'melds',         v_state -> 'melds'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Comprar do monte
-- ---------------------------------------------------------------------
create or replace function public.canastra_draw(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_stock text[]; v_card text; v_hand text[];
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id = s.player_id where s.token = p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;

  select * into v_room from canastra_rooms where id = v_player.room_id;
  select * into v_game from canastra_games where room_id = v_room.id for update;
  v_state := v_game.state;

  if (v_state ->> 'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state ->> 'phase' <> 'draw' then raise exception 'Você já comprou'; end if;

  v_stock := array(select jsonb_array_elements_text(v_state -> 'stock'));
  if array_length(v_stock, 1) is null then raise exception 'Monte vazio'; end if;

  v_card  := v_stock[1];
  v_stock := v_stock[2 : array_length(v_stock, 1)];
  v_hand  := array(select jsonb_array_elements_text(v_state -> 'hands' -> v_player.id::text));
  v_hand  := array_append(v_hand, v_card);

  v_state := jsonb_set(v_state, array['stock'], to_jsonb(v_stock));
  v_state := jsonb_set(v_state, array['hands', v_player.id::text], to_jsonb(v_hand));
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('discard'::text));

  update canastra_games set state = v_state, version = version + 1, updated_at = now() where id = v_game.id;
  update canastra_rooms set updated_at = now() where id = v_room.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Descartar (passa a vez)
-- ---------------------------------------------------------------------
create or replace function public.canastra_discard(p_token uuid, p_card text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player canastra_players; v_room canastra_rooms; v_game canastra_games;
  v_state jsonb; v_hand text[]; v_discard jsonb; v_next int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id = s.player_id where s.token = p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;

  select * into v_room from canastra_rooms where id = v_player.room_id;
  select * into v_game from canastra_games where room_id = v_room.id for update;
  v_state := v_game.state;

  if (v_state ->> 'turn_seat')::int <> v_player.seat then raise exception 'Não é sua vez'; end if;
  if v_state ->> 'phase' <> 'discard' then raise exception 'Compre antes de descartar'; end if;

  v_hand := array(select jsonb_array_elements_text(v_state -> 'hands' -> v_player.id::text));
  if not (p_card = any(v_hand)) then raise exception 'Carta não está na sua mão'; end if;

  v_hand    := array_remove(v_hand, p_card);  -- ids únicos: remove exatamente 1
  v_discard := (v_state -> 'discard') || to_jsonb(p_card);  -- topo = fim do array
  v_next    := (v_player.seat % 4) + 1;

  v_state := jsonb_set(v_state, array['hands', v_player.id::text], to_jsonb(v_hand));
  v_state := jsonb_set(v_state, array['discard'], v_discard);
  v_state := jsonb_set(v_state, array['phase'], to_jsonb('draw'::text));
  v_state := jsonb_set(v_state, array['turn_seat'], to_jsonb(v_next));

  update canastra_games set state = v_state, version = version + 1, updated_at = now() where id = v_game.id;
  update canastra_rooms set updated_at = now() where id = v_room.id;
end;
$$;

grant execute on function public.canastra_start_game(uuid) to anon, authenticated;
grant execute on function public.canastra_get_view(uuid)   to anon, authenticated;
grant execute on function public.canastra_draw(uuid)        to anon, authenticated;
grant execute on function public.canastra_discard(uuid, text) to anon, authenticated;
