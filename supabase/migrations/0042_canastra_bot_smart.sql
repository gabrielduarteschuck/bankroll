-- =====================================================================
-- Bots da simulação mais espertos:
--  - compram + descartam aleatório (como antes)
--  - baixam TRINCA de A ou 4 quando têm 3+
--  - ENCAIXAM A/4 em grupo já baixado da própria dupla
--  - quando o monte de compra acaba, encerram a rodada (morto)
-- Objetivo: simular o jogo inteiro (formar canastras, fechar rodada).
-- =====================================================================
create or replace function public.canastra_bot_step(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_room canastra_rooms; v_game canastra_games; v_state jsonb;
  v_seat int; v_player canastra_players; v_team text;
  v_stock text[]; v_hand text[]; v_card text; v_next int; v_pick text; v_len int;
  -- A/4 melding
  r text; v_rcards text[]; v_melds jsonb; i int; v_mi int; v_existing text[]; v_seq int;
  -- morto scoring
  t text; m jsonb; cc text[]; pts int; bonus int; clean boolean; sz int; red3 int; pen int; tot int;
  brk jsonb; n1 int; n2 int;
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

  -- ===== fase de compra =====
  if v_state->>'phase' = 'draw' then
    v_stock := array(select jsonb_array_elements_text(v_state->'stock'));

    -- monte vazio -> encerra a rodada por morto (pontua e fecha)
    if array_length(v_stock,1) is null then
      brk := '{}'::jsonb;
      for t in select unnest(array['1','2']) loop
        pts := 0; bonus := 0;
        for m in select * from jsonb_array_elements(v_state->'melds'->t) loop
          cc := array(select jsonb_array_elements_text(m->'cards'));
          pts := pts + canastra_meld_points(cc); sz := array_length(cc,1);
          if sz >= 7 then
            clean := not exists(select 1 from unnest(cc) c where substr(c,1,1)='2');
            if clean then bonus := bonus + 200 + 100*(sz-7); else bonus := bonus + 100; end if;
          end if;
        end loop;
        red3 := (v_state->'red3'->>t)::int * 100;
        pen := coalesce((select sum(case when left(c,2) in ('3S','3C') then 100 else canastra_card_value(c) end)
               from canastra_players pl, jsonb_array_elements_text(v_state->'hands'->pl.id::text) c
               where pl.room_id=p_room_id and pl.team::text=t), 0);
        tot := pts + bonus + red3 - pen;
        brk := brk || jsonb_build_object(t, jsonb_build_object('melds',pts,'canastras',bonus,'red3',red3,'bater',0,'penalidade',pen,'total',tot));
      end loop;
      n1 := v_room.score_team1 + (brk->'1'->>'total')::int;
      n2 := v_room.score_team2 + (brk->'2'->>'total')::int;
      v_state := jsonb_set(v_state, array['phase'], to_jsonb('over'::text));
      v_state := jsonb_set(v_state, array['last_round'], jsonb_build_object('bater_team',0,'reason','morto','breakdown',brk,'score_after',jsonb_build_object('1',n1,'2',n2)));
      update canastra_games set state=v_state, version=version+1, updated_at=now() where id=v_game.id;
      update canastra_rooms set score_team1=n1, score_team2=n2,
        status = case when greatest(n1,n2) >= v_room.target_score then 'finished' else 'playing' end,
        updated_at=now() where id=p_room_id;
      return true;
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

  -- ===== baixar/encaixar trincas de A e 4 =====
  for r in select unnest(array['A','4']) loop
    v_rcards := array(select c from unnest(v_hand) c where left(c,1)=r);
    if array_length(v_rcards,1) is null then continue; end if;

    v_melds := v_state->'melds'->v_team;
    v_mi := -1;
    for i in 0 .. coalesce(jsonb_array_length(v_melds),0)-1 loop
      if exists(select 1 from jsonb_array_elements_text(v_melds->i->'cards') x where left(x,1)=r)
         and not exists(select 1 from jsonb_array_elements_text(v_melds->i->'cards') x where left(x,1)<>r and left(x,1)<>'2')
      then v_mi := i; exit; end if;
    end loop;

    if v_mi >= 0 then
      -- encaixa todas as cartas do rank no grupo existente
      v_existing := array(select jsonb_array_elements_text(v_melds->v_mi->'cards'));
      v_melds := jsonb_set(v_melds, array[v_mi::text,'cards'], to_jsonb(v_existing || v_rcards));
      v_state := jsonb_set(v_state, array['melds',v_team], v_melds);
      v_state := jsonb_set(v_state, array['opened',v_team], 'true'::jsonb);
      foreach v_card in array v_rcards loop v_hand := array_remove(v_hand, v_card); end loop;
    elsif array_length(v_rcards,1) >= 3 then
      -- baixa nova trinca
      v_seq := coalesce((v_state->>'meld_seq')::int,0) + 1;
      v_melds := v_melds || jsonb_build_array(jsonb_build_object('id','m'||v_seq,'cards',to_jsonb(v_rcards)));
      v_state := jsonb_set(v_state, array['meld_seq'], to_jsonb(v_seq));
      v_state := jsonb_set(v_state, array['melds',v_team], v_melds);
      v_state := jsonb_set(v_state, array['opened',v_team], 'true'::jsonb);
      foreach v_card in array v_rcards loop v_hand := array_remove(v_hand, v_card); end loop;
    end if;
  end loop;
  v_state := jsonb_set(v_state, array['hands', v_player.id::text], to_jsonb(v_hand));

  -- ===== descarta carta aleatória e passa a vez =====
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
$function$;
