-- =====================================================================
-- Canastra (jogo de cartas) — Etapa 1: Salas e Lobby em tempo real
-- =====================================================================
-- Identidade dos jogadores é por NOME + TOKEN (sem login).
-- O token secreto fica em tabela separada (canastra_player_secrets),
-- sem leitura pública, para não vazar via Realtime.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.canastra_rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  status       text not null default 'lobby',  -- lobby | playing | finished
  dealer_seat  int,                             -- 1..4, definido no sorteio
  target_score int not null default 4000,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.canastra_players (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid not null references public.canastra_rooms(id) on delete cascade,
  name      text not null,
  seat      int,        -- 1..4, atribuído no sorteio das duplas
  team      int,        -- 1 ou 2
  is_host   boolean not null default false,
  joined_at timestamptz not null default now()
);

create table if not exists public.canastra_player_secrets (
  player_id uuid primary key references public.canastra_players(id) on delete cascade,
  token     uuid not null
  -- token NÃO é único: o mesmo dispositivo (navegador) pode ser jogador em
  -- várias salas/partidas. A identidade "qual jogador nesta sala" é resolvida
  -- por (room_id + token) no canastra_join_room.
);

create index if not exists idx_canastra_players_room on public.canastra_players(room_id);
create index if not exists idx_canastra_secrets_token on public.canastra_player_secrets(token);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.canastra_rooms          enable row level security;
alter table public.canastra_players        enable row level security;
alter table public.canastra_player_secrets enable row level security;

drop policy if exists canastra_rooms_select on public.canastra_rooms;
create policy canastra_rooms_select on public.canastra_rooms for select using (true);

drop policy if exists canastra_players_select on public.canastra_players;
create policy canastra_players_select on public.canastra_players for select using (true);
-- canastra_player_secrets: sem policy => RLS nega tudo (só funções SECURITY DEFINER acessam)

grant select on public.canastra_rooms   to anon, authenticated;
grant select on public.canastra_players to anon, authenticated;
revoke all on public.canastra_player_secrets from anon, authenticated;

-- Realtime entrega linha completa nos UPDATEs
alter table public.canastra_rooms   replica identity full;
alter table public.canastra_players replica identity full;

-- ---------------------------------------------------------------------
-- Funções internas
-- ---------------------------------------------------------------------
create or replace function public.canastra_gen_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sem I,O,0,1 (ambíguos)
  v_code text;
  i int;
  v_exists boolean;
begin
  loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.canastra_rooms r where r.code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

-- Sorteia duplas: embaralha os 4 jogadores nos assentos 1..4.
-- Assentos 1 e 3 = Dupla 1; assentos 2 e 4 = Dupla 2 (parceiros sentam cruzado).
create or replace function public.canastra_draw_teams(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_seat int := 1;
begin
  for r in
    select id from canastra_players where room_id = p_room_id order by random()
  loop
    update canastra_players
      set seat = v_seat,
          team = case when v_seat in (1, 3) then 1 else 2 end
      where id = r.id;
    v_seat := v_seat + 1;
  end loop;

  update canastra_rooms
    set dealer_seat = 1 + floor(random() * 4)::int,
        updated_at = now()
    where id = p_room_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs públicas
-- ---------------------------------------------------------------------
create or replace function public.canastra_create_room(p_name text, p_token uuid)
returns table(room_code text, room_id uuid, player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_code text;
  v_player_id uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nome obrigatório';
  end if;

  v_code := canastra_gen_code();
  insert into canastra_rooms(code) values (v_code) returning id into v_room_id;
  insert into canastra_players(room_id, name, is_host)
    values (v_room_id, trim(p_name), true) returning id into v_player_id;
  insert into canastra_player_secrets(player_id, token) values (v_player_id, p_token);

  return query select v_code, v_room_id, v_player_id;
end;
$$;

create or replace function public.canastra_join_room(p_code text, p_name text, p_token uuid)
returns table(room_code text, room_id uuid, player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.canastra_rooms;
  v_count int;
  v_player_id uuid;
  v_existing uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Nome obrigatório';
  end if;

  select * into v_room from canastra_rooms where code = upper(trim(p_code));
  if v_room.id is null then
    raise exception 'Sala não encontrada';
  end if;

  -- Reconexão: token já pertence a um jogador desta sala -> devolve o mesmo
  select s.player_id into v_existing
  from canastra_player_secrets s
  join canastra_players pl on pl.id = s.player_id
  where pl.room_id = v_room.id and s.token = p_token;
  if v_existing is not null then
    return query select v_room.code, v_room.id, v_existing;
    return;
  end if;

  if v_room.status <> 'lobby' then
    raise exception 'Partida já começou';
  end if;

  select count(*) into v_count from canastra_players where canastra_players.room_id = v_room.id;
  if v_count >= 4 then
    raise exception 'Mesa cheia';
  end if;

  insert into canastra_players(room_id, name) values (v_room.id, trim(p_name))
    returning id into v_player_id;
  insert into canastra_player_secrets(player_id, token) values (v_player_id, p_token);

  -- Completou 4 -> sorteia as duplas
  if v_count + 1 = 4 then
    perform canastra_draw_teams(v_room.id);
  end if;

  return query select v_room.code, v_room.id, v_player_id;
end;
$$;

grant execute on function public.canastra_create_room(text, uuid) to anon, authenticated;
grant execute on function public.canastra_join_room(text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.canastra_rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.canastra_players;
  exception when duplicate_object then null;
  end;
end $$;
