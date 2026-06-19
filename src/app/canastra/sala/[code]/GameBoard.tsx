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
  type PlayerView,
  subscribeRoom,
  takePile,
} from "@/lib/canastra";
import { supabaseReal } from "@/lib/supabaseClient";

async function endRound() {
  const { error } = await supabaseReal!.rpc("canastra_end_round", { p_token: getToken() });
  if (error) throw new Error(error.message);
}

// ordem para ordenar a mão (apenas exibição)
const RANK_ORDER = ["4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2", "3"];
const SUIT_ORDER = ["S", "H", "C", "D"];

function sortHand(cards: string[], mode: "none" | "rank" | "suit"): string[] {
  if (mode === "none") return cards;
  const arr = [...cards];
  if (mode === "rank") {
    arr.sort((a, b) => RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0]) || a[1].localeCompare(b[1]));
  } else {
    arr.sort(
      (a, b) => SUIT_ORDER.indexOf(a[1]) - SUIT_ORDER.indexOf(b[1]) || RANK_ORDER.indexOf(a[0]) - RANK_ORDER.indexOf(b[0])
    );
  }
  return arr;
}

// azul = dupla 1, vermelho = dupla 2
const teamColor = (t: number) => (t === 1 ? "#3b82f6" : "#ef4444");

export default function GameBoard({ roomId, code }: { roomId: string; code: string }) {
  const [view, setView] = useState<GameView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selMeld, setSelMeld] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"none" | "rank" | "suit">("rank");
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- animações (cartas voando) ----
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

  // ---- driver dos bots: quando é a vez de um bot, joga sozinho ----
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
        /* ignora: próximo tick tenta de novo */
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

  // dispara animações ao detectar mudanças de estado
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && view && view.status !== "lobby") {
      if (view.round !== prev.round && view.phase !== "over") {
        // distribuição: leva de cartas do monte para cada cadeira
        [1, 2, 3, 4, 1, 2, 3, 4].forEach((s, i) =>
          setTimeout(() => addFly(center(deckRef.current), center(seatRefs.current[s]), false), i * 90)
        );
      } else {
        if (view.stock_count < prev.stock_count) {
          addFly(center(deckRef.current), center(seatRefs.current[prev.turn_seat]), false);
        }
        if (view.discard_count > prev.discard_count) {
          addFly(center(seatRefs.current[prev.turn_seat]), center(lixoRef.current), true, view.discard_top);
        }
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
      <div className="fixed inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#1f7a4d,#0c3d24)] text-emerald-100">
        <p className="animate-pulse">Carregando mesa…</p>
      </div>
    );
  }

  const myTurn = view.turn_seat === view.you.seat;
  const myTeam = view.you.team;
  const phase = view.phase;
  const toggleCard = (c: string) => setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  // posições relativas ao jogador local
  const me = view.you.seat;
  const leftS = (me % 4) + 1;
  const topS = (leftS % 4) + 1;
  const rightS = (topS % 4) + 1;
  const bySeat = (s: number) => view.players.find((p) => p.seat === s) ?? null;
  const pTop = bySeat(topS);
  const pLeft = bySeat(leftS);
  const pRight = bySeat(rightS);

  // bandas de jogos baixados: a minha embaixo, a adversária em cima
  const oppTeam = myTeam === 1 ? 2 : 1;
  const myMelds = view.melds[String(myTeam)] ?? [];
  const oppMelds = view.melds[String(oppTeam)] ?? [];

  const hand = sortHand(view.your_hand, sortMode);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-white bg-[radial-gradient(ellipse_at_center,#1f7a4d_0%,#0c3d24_75%)]">
      {/* ===== HUD topo ===== */}
      <div className="relative z-20 flex items-start justify-between px-2 pt-2">
        <div className="flex items-center gap-2">
          <span className="bg-black/40 rounded-lg px-2.5 py-1 text-xs font-bold tracking-wide">🃏 Canastra</span>
          <span className="bg-black/25 rounded-lg px-2 py-1 text-[11px] font-mono">{code}</span>
        </div>
        <div className="flex items-start gap-2">
          <div className="bg-black/45 rounded-lg px-2.5 py-1.5 text-xs min-w-[96px]">
            <p className="text-[10px] text-white/60 font-semibold tracking-wider mb-0.5">PONTOS</p>
            {([1, 2] as const).map((t) => (
              <div key={t} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: teamColor(t) }} />
                  Dupla {t}
                </span>
                <b>{view.scores[String(t)]}</b>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <IconBtn title="Ajuda">?</IconBtn>
              <IconBtn title="Config">⚙️</IconBtn>
            </div>
            <a href="/canastra" className="text-center bg-red-600/80 hover:bg-red-600 rounded-md px-2 py-1 text-[11px] font-semibold">
              Sair
            </a>
          </div>
        </div>
      </div>

      {/* ===== Adversário do topo (parceiro fica embaixo? não: topo = parceiro) ===== */}
      <div className="relative z-10 flex flex-col items-center mt-1" ref={(el) => { seatRefs.current[topS] = el; }}>
        <SeatBlock p={pTop} compact />
        <CardBackRow n={pTop?.hand_count ?? 0} />
      </div>

      {/* ===== Faixa de jogos da dupla adversária (em cima) ===== */}
      <MeldBand team={oppTeam} melds={oppMelds} label={`Jogos Dupla ${oppTeam}`} />

      {/* ===== Centro: jogadores laterais + MONTE + LIXO ===== */}
      <div className="relative z-10 flex-1 flex items-center justify-between px-1 min-h-0">
        <div className="flex flex-col items-center gap-1 w-20 shrink-0" ref={(el) => { seatRefs.current[leftS] = el; }}>
          <SeatBlock p={pLeft} side />
        </div>

        <div className="flex items-end justify-center gap-5">
          {/* MONTE */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold tracking-widest text-white/70 mb-0.5">MONTE</span>
            <div ref={deckRef}><CardBack big /></div>
            <span className="mt-0.5 text-xs font-bold bg-black/40 rounded px-1.5">{view.stock_count}</span>
          </div>
          {/* LIXO */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold tracking-widest text-white/70 mb-0.5">
              LIXO {view.discard_locked && "🔒"}
            </span>
            <div ref={lixoRef}>
              {view.discard_top ? (
                <Card card={view.discard_top} big />
              ) : (
                <div className="w-12 h-16 rounded-lg border border-dashed border-white/30" />
              )}
            </div>
            <span className="mt-0.5 text-xs font-bold bg-black/40 rounded px-1.5">{view.discard_count}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 w-20 shrink-0" ref={(el) => { seatRefs.current[rightS] = el; }}>
          <SeatBlock p={pRight} side />
        </div>
      </div>

      {/* ===== Faixa de jogos da minha dupla (embaixo) ===== */}
      <MeldBand
        team={myTeam}
        melds={myMelds}
        label={`Jogos Dupla ${myTeam} (sua)`}
        selectable={myTurn && phase === "play"}
        selMeld={selMeld}
        onSelect={(id) => setSelMeld((s) => (s === id ? null : id))}
      />

      {/* ===== Ações ===== */}
      <div className="relative z-10 px-2 py-1">
        {!myTurn ? (
          <p className="text-center text-sm text-emerald-100/80">
            Vez de <b>{view.players.find((p) => p.is_turn)?.name ?? "—"}</b>
          </p>
        ) : phase === "draw" ? (
          <div className="grid grid-cols-2 gap-2">
            {view.stock_count > 0 ? (
              <button onClick={() => run(drawCard)} disabled={busy} className="btn-primary">Comprar do monte</button>
            ) : (
              <button onClick={() => run(endRound)} disabled={busy} className="btn-ghost">Encerrar (monte vazio)</button>
            )}
            <button
              onClick={() =>
                run(() => (selMeld ? takePile("add", [], selMeld) : takePile("new", [...selected, view.discard_top!], null)))
              }
              disabled={busy || !view.discard_top || view.discard_locked || (!selMeld && selected.length < 2)}
              className="btn-amber"
            >
              Levar a mesa (LIXO)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            <button onClick={() => run(() => meldCards(selected))} disabled={busy || selected.length < 3} className="btn-primary !py-2 text-sm">Baixar</button>
            <button onClick={() => run(() => addToMeld(selMeld!, selected))} disabled={busy || !selMeld || selected.length < 1} className="btn-ghost !py-2 text-sm">Encaixar</button>
            <button onClick={() => run(() => discardCard(selected[0]))} disabled={busy || selected.length !== 1} className="btn-ghost !py-2 text-sm">Descartar</button>
            <button onClick={() => run(() => bate(selected.length === 1 ? selected[0] : null))} disabled={busy} className="btn-amber !py-2 text-sm">Bater</button>
          </div>
        )}
      </div>

      {/* ===== Jogador local: bloco + ordenar + mão ===== */}
      <div className="relative z-10 flex items-end gap-2 px-2 pb-2">
        <div className="flex flex-col items-center shrink-0" ref={(el) => { seatRefs.current[me] = el; }}>
          <SeatBlock p={view.players.find((p) => p.seat === me) ?? null} you />
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button onClick={() => setSortMode("suit")} className={`text-[10px] rounded px-1.5 py-1 ${sortMode === "suit" ? "bg-emerald-500 text-emerald-950" : "bg-black/30"}`}>♣ naipe</button>
          <button onClick={() => setSortMode("rank")} className={`text-[10px] rounded px-1.5 py-1 ${sortMode === "rank" ? "bg-emerald-500 text-emerald-950" : "bg-black/30"}`}># número</button>
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-1 pb-1" style={{ minWidth: "min-content" }}>
            {hand.map((c) => (
              <Card key={c} card={c} selected={selected.includes(c)} onClick={() => toggleCard(c)} />
            ))}
          </div>
        </div>
      </div>

      {/* ===== Chat recolhível ===== */}
      <div className="absolute bottom-2 right-2 z-30">
        {chatOpen ? (
          <div className="w-56 bg-black/70 backdrop-blur rounded-xl p-2 shadow-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold">💬 Chat</span>
              <button onClick={() => setChatOpen(false)} className="text-white/60 text-xs">✕</button>
            </div>
            <div className="h-24 text-[11px] text-white/40 grid place-items-center">em breve</div>
            <input disabled placeholder="Mensagem…" className="w-full mt-1 rounded bg-white/10 px-2 py-1 text-xs placeholder:text-white/30" />
          </div>
        ) : (
          <button onClick={() => setChatOpen(true)} className="bg-black/50 hover:bg-black/70 rounded-full px-3 py-2 text-xs font-semibold shadow">💬 Chat</button>
        )}
      </div>

      {/* ===== erro ===== */}
      {error && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 rounded-lg px-3 py-2 text-sm shadow-lg max-w-[90%] text-center">
          {error}
        </div>
      )}

      {/* ===== cartas voando (animações) ===== */}
      <AnimatePresence>
        {flying.map((f) => (
          <motion.div
            key={f.id}
            initial={{ x: f.from.x - 24, y: f.from.y - 32, scale: 0.9, rotate: -8 }}
            animate={{ x: f.to.x - 24, y: f.to.y - 32, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            onAnimationComplete={() => setFlying((a) => a.filter((z) => z.id !== f.id))}
            className="fixed left-0 top-0 z-40 pointer-events-none"
          >
            {f.faceUp ? <Card card={f.card || ""} big /> : <CardBack big />}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ===== fim de rodada / jogo ===== */}
      {phase === "over" && view.last_round && (
        <RoundOver view={view} busy={busy} onNext={() => run(nextRound)} />
      )}

      <style jsx global>{btnStyles}</style>
    </div>
  );
}

/* ============================ subcomponentes ============================ */

function IconBtn({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} className="w-7 h-7 grid place-items-center bg-black/35 hover:bg-black/55 rounded-md text-xs">
      {children}
    </button>
  );
}

function SeatBlock({ p, you, side, compact }: { p: PlayerView | null; you?: boolean; side?: boolean; compact?: boolean }) {
  if (!p) return <div className="w-16 h-12" />;
  const init = p.name.trim().slice(0, 2).toUpperCase();
  return (
    <div className={`flex ${side ? "flex-col" : "flex-row"} items-center gap-1.5 ${p.is_turn ? "" : "opacity-90"}`}>
      <div
        className={`relative grid place-items-center rounded-full font-bold text-white shadow-md ${compact || side ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm"} ${
          p.is_turn ? "ring-4 ring-amber-300/70 animate-pulse" : "ring-2 ring-black/30"
        }`}
        style={{ background: teamColor(p.team) }}
      >
        {init}
      </div>
      <div className={`${side ? "text-center" : ""} leading-tight`}>
        <p className="text-[11px] font-semibold truncate max-w-[72px]">{p.name}{you ? " (você)" : ""}</p>
        <p className="text-[9px] text-white/60">{p.hand_count} cartas{p.is_turn ? " · vez" : ""}</p>
      </div>
    </div>
  );
}

function CardBackRow({ n }: { n: number }) {
  return (
    <div className="flex -space-x-3 mt-0.5">
      {Array.from({ length: Math.min(n, 13) }).map((_, i) => (
        <CardBack key={i} mini />
      ))}
    </div>
  );
}

function MeldBand({
  team, melds, label, selectable, selMeld, onSelect,
}: {
  team: number; melds: Meld[]; label: string;
  selectable?: boolean; selMeld?: string | null; onSelect?: (id: string) => void;
}) {
  return (
    <div className="relative z-10 mx-2 my-1 rounded-xl border border-white/10 bg-black/15 px-2 py-1 min-h-[52px]">
      <span className="text-[10px] font-semibold" style={{ color: teamColor(team) }}>{label}</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {melds.length === 0 && <span className="text-[11px] text-white/30 py-2">sem jogos</span>}
        {melds.map((m) => (
          <button
            key={m.id}
            onClick={selectable && onSelect ? () => onSelect(m.id) : undefined}
            className={`shrink-0 rounded-lg p-1 transition ${selectable ? "cursor-pointer hover:bg-white/5" : "cursor-default"} ${
              selMeld === m.id ? "ring-2 ring-amber-300 bg-amber-300/10" : ""
            }`}
          >
            <div className="flex">
              {m.cards.map((c, i) => (
                <div key={c + i} style={{ marginLeft: i === 0 ? 0 : -16 }}>
                  <Card card={c} mini />
                </div>
              ))}
            </div>
            {m.is_canastra && (
              <span className={`block text-center text-[8px] font-bold ${m.clean ? "text-sky-300" : "text-amber-300"}`}>
                {m.clean ? "CANASTRA LIMPA" : "canastra suja"}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Card({ card, selected, onClick, big, mini }: { card: string; selected?: boolean; onClick?: () => void; big?: boolean; mini?: boolean }) {
  const { label, symbol, isRed, isWild } = parseCard(card);
  const size = mini ? "w-8 h-11" : big ? "w-12 h-16" : "w-10 h-14";
  const corner = mini ? "text-[9px]" : big ? "text-xs" : "text-[11px]";
  const center = mini ? "text-sm" : big ? "text-2xl" : "text-lg";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={`${size} relative rounded-md bg-white shadow border select-none shrink-0 transition grid place-items-center
        ${onClick ? "cursor-pointer" : ""}
        ${isWild ? "border-purple-500 ring-1 ring-purple-400" : "border-gray-300"}
        ${selected ? "-translate-y-2.5 ring-2 ring-amber-400" : ""}
        ${isRed ? "text-red-600" : "text-gray-900"}`}
    >
      <span className={`absolute top-0.5 left-1 font-bold leading-none ${corner}`}>{label}</span>
      <span className={`leading-none ${center}`}>{symbol}</span>
      {isWild && <span className="absolute bottom-0.5 right-0.5 text-[8px] text-purple-500">★</span>}
    </div>
  );
}

function CardBack({ big, mini }: { big?: boolean; mini?: boolean }) {
  const size = mini ? "w-7 h-10" : big ? "w-12 h-16" : "w-10 h-14";
  return (
    <div className={`${size} rounded-lg shadow border border-white/40 shrink-0 bg-blue-700`}
      style={{ backgroundImage: "repeating-linear-gradient(45deg,#1d4ed8 0 6px,#b91c1c 6px 12px)" }}
    />
  );
}

function RoundOver({ view, busy, onNext }: { view: GameView; busy: boolean; onNext: () => void }) {
  const lr = view.last_round!;
  const finished = view.status === "finished";
  const winner = lr.score_after["1"] >= lr.score_after["2"] ? "1" : "2";
  const labels: Record<string, string> = {
    melds: "Jogos", canastras: "Canastras", red3: "3 vermelho", bater: "Bater", captura: "Captura", penalidade: "Penalidade",
  };
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <div className="w-full max-w-sm bg-emerald-950 rounded-2xl border border-white/10 p-4 shadow-2xl">
        <p className="text-center font-bold text-lg mb-3">
          {finished ? `🏆 Dupla ${winner} venceu!` : lr.bater_team ? `Dupla ${lr.bater_team} bateu!` : "Monte esgotado (morto)"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["1", "2"] as const).map((t) => (
            <div key={t} className="rounded-xl p-3 bg-white/5 border border-white/10">
              <p className="font-semibold text-sm mb-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: teamColor(Number(t)) }} /> Dupla {t}
              </p>
              <div className="text-[11px] text-emerald-100/80 space-y-0.5">
                {Object.entries(labels).map(([k, lbl]) =>
                  lr.breakdown[t][k] !== undefined && lr.breakdown[t][k] !== 0 ? (
                    <div key={k} className="flex justify-between">
                      <span>{lbl}</span>
                      <span className={k === "penalidade" ? "text-red-300" : ""}>
                        {k === "penalidade" ? `-${lr.breakdown[t][k]}` : `+${lr.breakdown[t][k]}`}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
              <p className="mt-2 text-right font-bold">= {lr.score_after[t]}</p>
            </div>
          ))}
        </div>
        {!finished && view.you.is_host && (
          <button onClick={onNext} disabled={busy} className="btn-primary w-full mt-4">Próxima rodada →</button>
        )}
        {!finished && !view.you.is_host && (
          <p className="text-center text-xs text-emerald-200/60 mt-4">Aguardando o anfitrião…</p>
        )}
        {finished && (
          <a href="/canastra" className="btn-primary block text-center mt-4">Voltar ao início</a>
        )}
      </div>
    </div>
  );
}

const btnStyles = `
  .btn-primary{ background:#10b981; color:#04261b; font-weight:600; border-radius:.75rem; padding:.7rem; }
  .btn-primary:disabled{ opacity:.4; }
  .btn-ghost{ background:rgba(255,255,255,.12); color:#fff; font-weight:600; border-radius:.75rem; padding:.7rem; }
  .btn-ghost:disabled{ opacity:.35; }
  .btn-amber{ background:#f59e0b; color:#3a2503; font-weight:700; border-radius:.75rem; padding:.7rem; }
  .btn-amber:disabled{ opacity:.35; }
`;
