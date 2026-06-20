"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addToMeld,
  bate,
  botStep,
  type GameView,
  type Meld,
  discardCard,
  drawCard,
  getToken,
  getView,
  meldCards,
  nextRound,
  parseCard,
  restartSim,
  type PlayerView,
  subscribeRoom,
  takePile,
} from "@/lib/canastra";
import { supabaseReal } from "@/lib/supabaseClient";

async function endRound() {
  const { error } = await supabaseReal!.rpc("canastra_end_round", { p_token: getToken() });
  if (error) throw new Error(error.message);
}

const RANK_ORDER = ["4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2", "3"];
const SUIT_ORDER = ["S", "H", "C", "D"];

function sortHand(cards: string[], mode: "none" | "rank" | "suit"): string[] {
  if (mode === "none") return cards;
  const arr = [...cards];
  if (mode === "rank") {
    arr.sort((a, b) => RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]) || a[1].localeCompare(b[1]));
  } else {
    arr.sort((a, b) => SUIT_ORDER.indexOf(a[1]) - SUIT_ORDER.indexOf(b[1]) || RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]));
  }
  return arr;
}

const teamColor = (t: number) => (t === 1 ? "#3f86d8" : "#d23b34");
const FELT = "radial-gradient(at 50% 42%, #2c9760 0%, #1f7d4d 42%, #166040 76%, #0e4a30 100%)";
const OUTER = "radial-gradient(at 50% 38%, #123c28 0%, #0c2a1c 60%, #07150e 100%)";
const goldStyle = { background: "linear-gradient(#f6d569,#d9a72f)", color: "#2a1c05" } as const;
const darkStyle = { background: "rgba(7,26,18,.7)", color: "#fff", border: "1px solid rgba(255,255,255,.1)" } as const;

export default function GameBoard({ roomId, code }: { roomId: string; code: string }) {
  const [view, setView] = useState<GameView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selMeld, setSelMeld] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"none" | "rank" | "suit">("rank");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(true);

  useEffect(() => {
    const f = () => setPortrait(window.innerHeight >= window.innerWidth);
    f();
    window.addEventListener("resize", f);
    window.addEventListener("orientationchange", f);
    return () => {
      window.removeEventListener("resize", f);
      window.removeEventListener("orientationchange", f);
    };
  }, []);

  type Fly = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; faceUp: boolean; card?: string | null };
  const deckRef = useRef<HTMLDivElement | null>(null);
  const lixoRef = useRef<HTMLDivElement | null>(null);
  const seatRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const prevRef = useRef<GameView | null>(null);
  const flyId = useRef(0);
  const [flying, setFlying] = useState<Fly[]>([]);

  const center = (el: HTMLElement | null) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const addFly = useCallback((from: { x: number; y: number } | null, to: { x: number; y: number } | null, faceUp: boolean, card?: string | null) => {
    if (!from || !to) return;
    const id = ++flyId.current;
    setFlying((f) => [...f, { id, from, to, faceUp, card }]);
  }, []);

  const load = useCallback(async () => {
    try {
      setView(await getView());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeRoom(roomId, () => void load());
    return () => unsub();
  }, [load, roomId]);

  const botBusy = useRef(false);
  useEffect(() => {
    if (!view || view.status !== "playing" || view.phase === "over") return;
    const turnP = view.players.find((p) => p.is_turn);
    if (!turnP?.is_bot || botBusy.current) return;
    botBusy.current = true;
    const t = setTimeout(async () => {
      try {
        await botStep(roomId);
      } catch {
        /* próximo tick tenta de novo */
      } finally {
        botBusy.current = false;
        await load();
      }
    }, 850);
    return () => {
      clearTimeout(t);
      botBusy.current = false;
    };
  }, [view, roomId, load]);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev && view && view.status !== "lobby") {
      if (view.round !== prev.round && view.phase !== "over") {
        [1, 2, 3, 4, 1, 2, 3, 4].forEach((s, i) =>
          setTimeout(() => addFly(center(deckRef.current), center(seatRefs.current[s]), false), i * 90)
        );
      } else {
        if (view.stock_count < prev.stock_count) addFly(center(deckRef.current), center(seatRefs.current[prev.turn_seat]), false);
        if (view.discard_count > prev.discard_count) addFly(center(seatRefs.current[prev.turn_seat]), center(lixoRef.current), true, view.discard_top);
      }
    }
    prevRef.current = view;
  }, [view, addFly]);

  function flash(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3500);
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setSelected([]);
      setSelMeld(null);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return (
      <div className="fixed inset-0 grid place-items-center text-emerald-100" style={{ background: OUTER, backgroundColor: "#0a1f15" }}>
        <p className="animate-pulse">Carregando mesa…</p>
      </div>
    );
  }

  const myTurn = view.turn_seat === view.you.seat;
  const myTeam = view.you.team;
  const phase = view.phase;
  const toggleCard = (c: string) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  const me = view.you.seat;
  const leftS = (me % 4) + 1;
  const topS = (leftS % 4) + 1;
  const rightS = (topS % 4) + 1;
  const bySeat = (s: number) => view.players.find((p) => p.seat === s) ?? null;
  const pTop = bySeat(topS);
  const pLeft = bySeat(leftS);
  const pRight = bySeat(rightS);
  const pMe = view.players.find((p) => p.seat === me) ?? null;
  const hasBots = view.players.some((p) => p.is_bot);

  const oppTeam = myTeam === 1 ? 2 : 1;
  const myMelds = view.melds[String(myTeam)] ?? [];
  const oppMelds = view.melds[String(oppTeam)] ?? [];
  const hand = sortHand(view.your_hand, sortMode);
  const turnName = view.players.find((p) => p.is_turn)?.name ?? "—";

  // ---------- blocos reutilizáveis ----------
  const logoBadge = (
    <div className="rounded-xl px-3 py-1.5 shrink-0" style={{ background: "rgba(7,26,18,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
      <div style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, lineHeight: 1 }} className="text-[14px] tracking-tight">
        <span className="text-white">GRUPO </span>
        <span style={{ color: "#f3c64a" }}>DUARTE</span>
      </div>
      <div className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-bold" style={goldStyle}>★ MESA RANKEADA</div>
    </div>
  );

  const hudRight = (
    <div className="flex items-start gap-1.5 shrink-0">
      <div className="rounded-xl px-2.5 py-1.5 text-[11px]" style={{ background: "rgba(7,26,18,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
        <p className="text-[8px] font-bold tracking-[.18em] text-white/55 mb-0.5">PONTOS</p>
        {([1, 2] as const).map((t) => (
          <div key={t} className="flex items-center justify-between gap-2 leading-5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: teamColor(t) }} />
            <b className="tabular-nums">{view.scores[String(t)]}</b>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <a href="/canastra" className="rounded-lg px-2 py-1 text-[11px] font-bold text-center" style={{ background: "rgba(210,59,52,.9)", color: "#fff" }}>✕ Sair</a>
        {hasBots && view.you.is_host ? (
          <button onClick={() => run(restartSim)} disabled={busy} className="rounded-lg px-2 py-1 text-[11px] font-bold disabled:opacity-50" style={goldStyle}>🔄 Reiniciar</button>
        ) : (
          <div className="flex gap-1">
            <IconBtn>?</IconBtn>
            <IconBtn>⚙</IconBtn>
          </div>
        )}
      </div>
    </div>
  );

  const monteLixoEl = (
    <div className="flex items-end justify-center gap-6">
      <Pile label="MONTE" count={view.stock_count} innerRef={deckRef}><CardBack red lg /></Pile>
      <Pile label={`LIXO${view.discard_locked ? " 🔒" : ""}`} count={view.discard_count} innerRef={lixoRef}>
        {view.discard_top ? <Card card={view.discard_top} size="lg" /> : <div className="w-[52px] h-[72px] rounded-[8px] border-2 border-dashed border-white/25" />}
      </Pile>
    </div>
  );

  const oppMeldsEl = <MeldZone melds={oppMelds} team={oppTeam} />;
  // jogos da dupla selecionáveis durante toda a minha vez (play E draw):
  // no draw, selecionar um jogo permite "Pegar lixo" encaixando a carta do topo nele
  const myMeldsEl = (
    <MeldZone melds={myMelds} team={myTeam} selectable={myTurn && phase !== "over"} selMeld={selMeld} onSelect={(id) => setSelMeld((s) => (s === id ? null : id))} />
  );

  const actionPanelEl = (
    <div className="rounded-2xl px-3 py-2 flex items-center justify-center gap-2 flex-wrap shadow-xl max-w-[96vw]" style={{ background: "rgba(9,20,14,.9)", border: "1px solid rgba(255,255,255,.08)" }}>
      {!myTurn ? (
        <span className="text-sm text-white/80 px-2">Vez de <b style={{ color: "#f3c64a" }}>{turnName}</b></span>
      ) : phase === "draw" ? (
        <>
          {view.stock_count > 0 ? (
            <Btn gold onClick={() => run(drawCard)} disabled={busy}>Comprar do monte</Btn>
          ) : (
            <Btn onClick={() => run(endRound)} disabled={busy}>Encerrar (monte vazio)</Btn>
          )}
          <Btn onClick={() => run(() => (selMeld ? takePile("add", [], selMeld) : takePile("new", [...selected, view.discard_top!], null)))} disabled={busy || !view.discard_top || view.discard_locked || (!selMeld && selected.length < 2)}>Pegar lixo</Btn>
        </>
      ) : (
        <>
          <Btn onClick={() => run(() => meldCards(selected))} disabled={busy || selected.length < 3}>Baixar jogo</Btn>
          <Btn onClick={() => run(() => addToMeld(selMeld!, selected))} disabled={busy || !selMeld || selected.length < 1}>Encaixar</Btn>
          <Btn onClick={() => run(() => discardCard(selected[0]))} disabled={busy || selected.length !== 1}>Descartar</Btn>
          <Btn gold onClick={() => run(() => bate(selected.length === 1 ? selected[0] : null))} disabled={busy}>Bater</Btn>
        </>
      )}
    </div>
  );

  const orderBtns = (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] text-white/55 font-semibold leading-none">ordenar</span>
      <div className="flex gap-1">
        <button onClick={() => setSortMode("suit")} className="w-7 h-7 rounded-md text-xs font-bold grid place-items-center" style={sortMode === "suit" ? goldStyle : darkStyle}>♠</button>
        <button onClick={() => setSortMode("rank")} className="w-7 h-7 rounded-md text-xs font-bold grid place-items-center" style={sortMode === "rank" ? goldStyle : darkStyle}>A</button>
      </div>
    </div>
  );

  // mão: fileira de até 13 cartas (leque); o que passar disso vira fileira ACIMA
  const PER_ROW = 13;
  const multiRow = hand.length > PER_ROW;
  const chunks: string[][] = [];
  for (let i = 0; i < hand.length; i += PER_ROW) chunks.push(hand.slice(i, i + PER_ROW));
  const handRows = multiRow ? [...chunks].reverse() : [hand]; // base = 1ª fileira; excedente acima
  const handEl = (
    <div className="flex flex-col items-center">
      {handRows.map((row, ri) => {
        const mid = (row.length - 1) / 2;
        return (
          <div key={ri} className="flex items-end justify-center" style={{ marginTop: ri > 0 ? -20 : 0 }}>
            {row.map((c, i) => {
              const sel = selected.includes(c);
              const ang = multiRow ? 0 : (i - mid) * 4.2;
              const lift = multiRow ? 0 : Math.abs(i - mid) ** 2 * 0.5;
              return (
                <div
                  key={c}
                  onClick={() => toggleCard(c)}
                  className="cursor-pointer"
                  style={{ transform: `rotate(${ang}deg) translateY(${lift - (sel ? 16 : 0)}px)`, transformOrigin: "bottom center", marginLeft: i === 0 ? 0 : multiRow ? -16 : -18, zIndex: sel ? 50 : i }}
                >
                  <Card card={c} size={multiRow ? "sm" : "md"} selected={sel} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden text-white" style={{ background: OUTER, backgroundColor: "#0a1f15", fontFamily: "Manrope, system-ui, sans-serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* feltro */}
      <div className="absolute inset-2 sm:inset-4 rounded-[34px]" style={{ background: FELT, boxShadow: "inset 0 0 80px rgba(0,0,0,.45), 0 10px 40px rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.06)" }}>
        <div className="absolute inset-0 grid place-items-center pointer-events-none select-none" style={{ fontFamily: "Archivo, sans-serif", fontWeight: 900, color: "rgba(255,255,255,.05)", fontSize: portrait ? "14vw" : "9vw", letterSpacing: ".06em", whiteSpace: "nowrap" }}>
          GRUPO DUARTE
        </div>
      </div>

      {portrait ? (
        /* ====================== RETRATO ====================== */
        <div className="absolute inset-0 z-10 flex flex-col px-1.5 pt-2 pb-1.5">
          <div className="flex items-start justify-between gap-1">{logoBadge}{hudRight}</div>

          <div className="flex flex-col items-center mt-1" ref={(el) => { seatRefs.current[topS] = el; }}>
            <Chip p={pTop} />
            <BackFan n={pTop?.hand_count ?? 0} />
          </div>

          <div className="mt-1.5 min-h-[58px]">{oppMeldsEl}</div>

          <div className="flex items-center justify-between mt-2 px-1">
            <div ref={(el) => { seatRefs.current[leftS] = el; }}><Chip p={pLeft} mini /></div>
            {monteLixoEl}
            <div ref={(el) => { seatRefs.current[rightS] = el; }}><Chip p={pRight} mini /></div>
          </div>

          <div className="mt-2 min-h-[58px]">{myMeldsEl}</div>

          <div className="flex-1 min-h-0" />

          <div className="flex justify-center mb-1">{actionPanelEl}</div>

          <div className="flex items-center justify-between px-1">
            <div ref={(el) => { seatRefs.current[me] = el; }}><Chip p={pMe} you /></div>
            {orderBtns}
          </div>
          <div className="flex items-end justify-center pt-1 pb-1">{handEl}</div>
        </div>
      ) : (
        /* ====================== PAISAGEM ====================== */
        <div className="absolute inset-0 z-10">
          <div className="absolute top-3 left-3 z-30">{logoBadge}</div>
          <div className="absolute top-3 right-3 z-30">{hudRight}</div>

          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1" ref={(el) => { seatRefs.current[topS] = el; }}>
            <Chip p={pTop} />
            <BackFan n={pTop?.hand_count ?? 0} />
          </div>

          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2" ref={(el) => { seatRefs.current[leftS] = el; }}>
            <Chip p={pLeft} />
            <BackPile n={pLeft?.hand_count ?? 0} />
          </div>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2" ref={(el) => { seatRefs.current[rightS] = el; }}>
            <BackPile n={pRight?.hand_count ?? 0} />
            <Chip p={pRight} />
          </div>

          <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3 w-[60%]">
            {oppMeldsEl}
            {monteLixoEl}
            {myMeldsEl}
          </div>

          <div className="absolute bottom-[104px] left-1/2 -translate-x-1/2 z-30">{actionPanelEl}</div>

          <div className="absolute bottom-3 left-3 z-30 flex items-end gap-2">
            <div ref={(el) => { seatRefs.current[me] = el; }}><Chip p={pMe} you /></div>
            {orderBtns}
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-end justify-center">{handEl}</div>
        </div>
      )}

      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 rounded-lg px-3 py-2 text-sm shadow-lg max-w-[90%] text-center" style={{ background: "rgba(210,59,52,.92)" }}>{error}</div>
      )}

      <AnimatePresence>
        {flying.map((f) => (
          <motion.div
            key={f.id}
            initial={{ x: f.from.x - 26, y: f.from.y - 36, scale: 0.9, rotate: -8 }}
            animate={{ x: f.to.x - 26, y: f.to.y - 36, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onAnimationComplete={() => setFlying((a) => a.filter((z) => z.id !== f.id))}
            className="fixed left-0 top-0 z-40 pointer-events-none"
          >
            {f.faceUp ? <Card card={f.card || ""} size="lg" /> : <CardBack red lg />}
          </motion.div>
        ))}
      </AnimatePresence>

      {phase === "over" && view.last_round && <RoundOver view={view} busy={busy} onNext={() => run(nextRound)} />}
    </div>
  );
}

/* ============================ subcomponentes ============================ */

function Btn({ children, onClick, disabled, gold }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; gold?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="rounded-xl px-3 py-2 text-sm font-bold whitespace-nowrap transition disabled:opacity-35" style={gold ? goldStyle : darkStyle}>
      {children}
    </button>
  );
}

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="w-7 h-7 grid place-items-center rounded-lg text-sm" style={{ background: "rgba(7,26,18,.7)", border: "1px solid rgba(255,255,255,.08)" }}>{children}</button>
  );
}

function Chip({ p, you, mini }: { p: PlayerView | null; you?: boolean; mini?: boolean }) {
  if (!p) return <div className="h-9 w-9" />;
  if (mini) {
    return (
      <div className="flex flex-col items-center gap-0.5 w-16">
        <div className="relative w-9 h-9 rounded-lg grid place-items-center text-white/80" style={{ background: "rgba(7,26,18,.78)", border: p.is_turn ? "1.5px solid #f3c64a" : "1px solid rgba(255,255,255,.1)", boxShadow: p.is_turn ? "0 0 12px rgba(243,198,74,.4)" : "none" }}>
          👤
          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-black/40" style={{ background: teamColor(p.team) }} />
        </div>
        <p className="text-[10px] font-bold truncate max-w-[64px] leading-none">{p.name}</p>
        <p className="text-[9px] text-white/55 leading-none">{p.hand_count} cartas</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl pl-1 pr-3 py-1" style={{ background: "rgba(7,26,18,.78)", border: p.is_turn ? "1.5px solid #f3c64a" : "1px solid rgba(255,255,255,.08)", boxShadow: p.is_turn ? "0 0 14px rgba(243,198,74,.4)" : "none" }}>
      <div className="relative w-8 h-8 rounded-lg grid place-items-center text-white/80" style={{ background: "rgba(255,255,255,.12)" }}>
        👤
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-black/40" style={{ background: teamColor(p.team) }} />
      </div>
      <div className="leading-tight">
        <p className="text-[12px] font-bold truncate max-w-[92px]">{p.name}{you ? " (você)" : ""}</p>
        <p className="text-[10px] text-white/55">{p.hand_count} cartas</p>
      </div>
      {p.is_turn && <span className="ml-1 w-4 h-4 rounded-full grid place-items-center text-[9px] font-extrabold" style={goldStyle}>●</span>}
    </div>
  );
}

function BackFan({ n }: { n: number }) {
  const count = Math.min(n, 13);
  const mid = (count - 1) / 2;
  return (
    <div className="flex items-start justify-center h-9">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ transform: `rotate(${(i - mid) * 3}deg)`, transformOrigin: "bottom center", marginLeft: i === 0 ? 0 : -18 }}>
          <CardBack sm />
        </div>
      ))}
    </div>
  );
}

function BackPile({ n }: { n: number }) {
  const count = Math.min(n, 5);
  return (
    <div className="relative" style={{ width: 40, height: 56 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="absolute" style={{ left: i * 2.5, top: i * 1.5 }}>
          <CardBack sm />
        </div>
      ))}
    </div>
  );
}

function Pile({ label, count, innerRef, children }: { label: string; count: number; innerRef?: React.Ref<HTMLDivElement>; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold tracking-[.16em] text-white/70">{label}</span>
      <div ref={innerRef}>{children}</div>
      <span className="text-[12px] font-extrabold rounded px-1.5 tabular-nums" style={{ background: "rgba(7,26,18,.7)" }}>{count}</span>
    </div>
  );
}

function MeldZone({ melds, team, selectable, selMeld, onSelect }: { melds: Meld[]; team: number; selectable?: boolean; selMeld?: string | null; onSelect?: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 w-full">
      {melds.length === 0 && <span className="text-[10px] text-white/25">— jogos da dupla {team} —</span>}
      {melds.map((m) => (
        <div
          key={m.id}
          onClick={selectable && onSelect ? () => onSelect(m.id) : undefined}
          className={`rounded-lg p-1 transition ${selectable ? "cursor-pointer" : ""} ${selMeld === m.id ? "ring-2 ring-amber-300" : ""}`}
          style={{ background: "rgba(7,26,18,.4)" }}
        >
          <div className="flex">
            {m.cards.map((c, i) => (
              <div key={c + i} style={{ marginLeft: i === 0 ? 0 : -18 }}>
                <Card card={c} size="sm" />
              </div>
            ))}
          </div>
          {m.is_canastra && (
            <span className="block text-center text-[8px] font-bold mt-0.5" style={{ color: m.clean ? "#7ec8ff" : "#f3c64a" }}>{m.clean ? "CANASTRA LIMPA" : "CANASTRA SUJA"}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Card({ card, selected, onClick, size = "md" }: { card: string; selected?: boolean; onClick?: () => void; size?: "sm" | "md" | "lg" }) {
  const { label, symbol, isRed, isWild } = parseCard(card);
  const dim = size === "sm" ? { w: 38, h: 54, r: 6, rank: 11, suit: 8, big: 16 } : size === "lg" ? { w: 52, h: 72, r: 8, rank: 15, suit: 11, big: 26 } : { w: 46, h: 66, r: 8, rank: 14, suit: 10, big: 22 };
  const color = isRed ? "#d23b34" : "#1b1b22";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className="relative shrink-0 select-none transition"
      style={{
        width: dim.w, height: dim.h, borderRadius: dim.r,
        background: "linear-gradient(#ffffff,#f3f1ea)", color,
        border: isWild ? "2px solid #a855f7" : "1px solid rgba(0,0,0,.18)",
        boxShadow: selected ? "0 0 0 2px #f3c64a, 0 6px 14px rgba(0,0,0,.4)" : "0 2px 5px rgba(0,0,0,.35)",
        cursor: onClick ? "pointer" : "default",
        transform: selected ? "translateY(-2px)" : "none",
        fontFamily: "Manrope, sans-serif",
      }}
    >
      <div className="absolute top-0.5 left-1 text-center leading-none" style={{ fontWeight: 800 }}>
        <div style={{ fontSize: dim.rank, lineHeight: 1 }}>{label}</div>
        <div style={{ fontSize: dim.suit, lineHeight: 1 }}>{symbol}</div>
      </div>
      <div className="absolute inset-0 grid place-items-center" style={{ fontSize: dim.big, opacity: 0.92 }}>{symbol}</div>
      {isWild && <div className="absolute bottom-0.5 right-1 text-[9px]" style={{ color: "#a855f7" }}>★</div>}
    </div>
  );
}

function CardBack({ red, lg, sm }: { red?: boolean; lg?: boolean; sm?: boolean }) {
  const w = lg ? 52 : sm ? 32 : 46;
  const h = lg ? 72 : sm ? 46 : 66;
  const grad = red ? "linear-gradient(135deg,#cf463e,#9e2a25)" : "linear-gradient(135deg,#2f5fb0,#21408a)";
  return (
    <div
      className="relative shrink-0"
      style={{
        width: w, height: h, borderRadius: 8,
        backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.15) 0px, rgba(255,255,255,.15) 4px, transparent 4px, transparent 9px), ${grad}`,
        border: "2px solid rgba(255,255,255,.55)", boxShadow: "0 2px 5px rgba(0,0,0,.4)",
      }}
    >
      <div className="absolute inset-0 grid place-items-center text-white/70" style={{ fontSize: lg ? 16 : 11 }}>◆</div>
    </div>
  );
}

function RoundOver({ view, busy, onNext }: { view: GameView; busy: boolean; onNext: () => void }) {
  const lr = view.last_round!;
  const finished = view.status === "finished";
  const winner = lr.score_after["1"] >= lr.score_after["2"] ? "1" : "2";
  const labels: Record<string, string> = { melds: "Jogos", canastras: "Canastras", red3: "3 vermelho", bater: "Bater", captura: "Captura", penalidade: "Penalidade" };
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl p-4 shadow-2xl" style={{ background: "#0a1f15", border: "1px solid rgba(255,255,255,.1)" }}>
        <p className="text-center font-bold text-lg mb-3">{finished ? `🏆 Dupla ${winner} venceu!` : lr.bater_team ? `Dupla ${lr.bater_team} bateu!` : "Monte esgotado"}</p>
        <div className="grid grid-cols-2 gap-3">
          {(["1", "2"] as const).map((t) => (
            <div key={t} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)" }}>
              <p className="font-semibold text-sm mb-1 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: teamColor(Number(t)) }} /> Dupla {t}
              </p>
              <div className="text-[11px] text-emerald-100/80 space-y-0.5">
                {Object.entries(labels).map(([k, lbl]) =>
                  lr.breakdown[t][k] !== undefined && lr.breakdown[t][k] !== 0 ? (
                    <div key={k} className="flex justify-between">
                      <span>{lbl}</span>
                      <span className={k === "penalidade" ? "text-red-300" : ""}>{k === "penalidade" ? `-${lr.breakdown[t][k]}` : `+${lr.breakdown[t][k]}`}</span>
                    </div>
                  ) : null
                )}
              </div>
              <p className="mt-2 text-right font-bold">= {lr.score_after[t]}</p>
            </div>
          ))}
        </div>
        {!finished && view.you.is_host && <button onClick={onNext} disabled={busy} className="w-full mt-4 rounded-xl py-3 font-bold disabled:opacity-40" style={goldStyle}>Próxima rodada →</button>}
        {!finished && !view.you.is_host && <p className="text-center text-xs text-white/55 mt-4">Aguardando o anfitrião…</p>}
        {finished && <a href="/canastra" className="block text-center mt-4 rounded-xl py-3 font-bold" style={goldStyle}>Voltar ao início</a>}
      </div>
    </div>
  );
}
