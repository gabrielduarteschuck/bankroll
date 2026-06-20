-- =====================================================================
-- Mesa simulada: sempre fresca + botão de reiniciar
--  - canastra_create_sim_room: apaga as salas simuladas anteriores do
--    mesmo jogador antes de criar uma nova (não acumula partidas velhas)
--  - canastra_restart_sim: re-distribui e zera a partida atual (host)
-- =====================================================================

create or replace function public.canastra_create_sim_room(p_token uuid)
returns table(room_code text, room_id uuid, player_id uuid)
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_room_id uuid; v_code text; v_player_id uuid; v_state jsonb; v_dealer int;
begin
  -- limpa salas simuladas anteriores deste jogador (host + com bots)
  delete from canastra_rooms r
  using canastra_players pl, canastra_player_secrets s
  where pl.room_id = r.id and pl.is_host and s.player_id = pl.id and s.token = p_token
    and exists (select 1 from canastra_players b where b.room_id = r.id and b.is_bot);

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

  perform canastra_draw_teams(v_room_id);
  select dealer_seat into v_dealer from canastra_rooms where id=v_room_id;
  v_state := canastra_deal(v_room_id, v_dealer, 1);
  insert into canastra_games(room_id, state, version) values (v_room_id, v_state, 1);
  update canastra_rooms set status='playing', round_no=1, updated_at=now() where id=v_room_id;

  return query select v_code, v_room_id, v_player_id;
end;
$function$;

-- Reinicia a partida atual (somente host): nova distribuição, placar zerado.
create or replace function public.canastra_restart_sim(p_token uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_player canastra_players; v_room canastra_rooms; v_state jsonb; v_dealer int;
begin
  select pl.* into v_player from canastra_player_secrets s
    join canastra_players pl on pl.id=s.player_id where s.token=p_token;
  if v_player.id is null then raise exception 'Jogador não encontrado'; end if;
  if not v_player.is_host then raise exception 'Apenas o anfitrião reinicia'; end if;
  select * into v_room from canastra_rooms where id=v_player.room_id for update;

  v_dealer := 1 + floor(random()*4)::int;
  v_state := canastra_deal(v_room.id, v_dealer, 1);
  insert into canastra_games(room_id, state, version) values (v_room.id, v_state, 1)
    on conflict (room_id) do update set state=excluded.state, version=1, updated_at=now();
  update canastra_rooms set status='playing', round_no=1, dealer_seat=v_dealer,
    score_team1=0, score_team2=0, obrigada1=150, obrigada2=150, updated_at=now()
    where id=v_room.id;
end;
$function$;

grant execute on function public.canastra_restart_sim(uuid) to anon, authenticated;
