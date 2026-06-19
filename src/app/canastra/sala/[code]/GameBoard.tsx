"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addToMeld,
  bate,
  type GameView,
  type Meld,
  discardCard,
  drawCard,
  getView,
  meldCards,
  nextRound,
  parseCard,
  startGame,
  subscribeRoom,
  takePile,
  type PlayerView,
} from "@/lib/canastra";

// extra: encerrar rodada por monte vazio (não está no rpc helper genérico)
import { supabaseReal } from "@/lib/supabaseClient";
import { getToken } from "@/lib/canastra";
async function endRound() {
  const { error } = await supabaseReal!.rpc("canastra_end_round", { p_token: getToken() });
  if (error) throw new Error(error.message);
}

export default function GameBoard({ roomId }: { roomId: string }) {
  const [view, setView] = useState<GameView | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selMeld, setSelMeld] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return <div className="text-center text-emerald-200/70 animate-pulse py-10">Carregando mesa…</div>;
  }

  const myTurn = view.turn_seat === view.you.seat;
  const myTeam = String(view.you.team);
  const phase = view.phase;
  const toggleCard = (c: string) =>
    setSelected((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  // ----- painel de fim de rodada / fim de jogo -----
  if (phase === "over" && view.last_round) {
    const lr = view.last_round;
    const finished = view.status === "finished";
    const winner = lr.score_after["1"] >= lr.score_after["2"] ? "1" : "2";
    return (
      <div className="flex flex-col gap-4">
        <ScoreHeader view={view} />
        <div className="rounded-2xl bg-black/30 border border-white/10 p-4">
          <p className="text-center font-bold text-lg mb-3">
            {finished ? `🏆 Dupla ${winner} venceu!` : lr.bater_team ? `Dupla ${lr.bater_team} bateu!` : "Monte esgotado (morto)"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["1", "2"] as const).map((t) => (
              <div key={t} className={`rounded-xl p-3 ${t === myTeam ? "bg-emerald-500/15 border border-emerald-400/30" : "bg-white/5 border border-white/10"}`}>
                <p className="font-semibold text-sm mb-1">Dupla {t}</p>
                <Breakdown b={lr.breakdown[t]} />
                <p className="mt-2 text-right font-bold">= {lr.score_after[t]} pts</p>
              </div>
            ))}
          </div>
        </div>
        {!finished && view.you.is_host && (
          <button onClick={() => run(nextRound)} disabled={busy} className="btn-primary">
            Próxima rodada →
          </button>
        )}
        {!finished && !view.you.is_host && (
          <p className="text-center text-sm text-emerald-200/60">Aguardando o anfitrião iniciar a próxima rodada…</p>
        )}
        {error && <ErrorBar msg={error} />}
        <style jsx global>{btnStyles}</style>
      </div>
    );
  }

  const others = view.players.filter((p) => p.player_id !== view.you.player_id);

  return (
    <div className="flex flex-col gap-3">
      <ScoreHeader view={view} />

      {/* adversários / parceiro */}
      <div className="grid grid-cols-3 gap-2">
        {others.map((p) => (
          <PlayerChip key={p.player_id} p={p} myTeam={view.you.team} />
        ))}
      </div>

      {/* centro: monte + descarte */}
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="text-center">
          <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-white/20 flex items-center justify-center text-white/40 text-2xl">🂠</div>
          <p className="text-xs mt-1 text-emerald-200/80">monte<br /><b className="text-white">{view.stock_count}</b></p>
        </div>
        <div className="text-center">
          {view.discard_top ? <Card card={view.discard_top} /> : <div className="w-12 h-16 rounded-lg border border-dashed border-white/20" />}
          <p className="text-xs mt-1 text-emerald-200/80">
            descarte<br /><b className="text-white">{view.discard_count}</b>
            {view.discard_locked && <span title="trancada"> 🔒</span>}
          </p>
        </div>
      </div>

      {/* jogos baixados */}
      <div className="grid grid-cols-2 gap-2">
        {(["1", "2"] as const).map((t) => (
          <div key={t} className="rounded-xl bg-black/20 border border-white/10 p-2 min-h-[60px]">
            <p className="text-[11px] font-semibold text-emerald-300 mb-1">
              Jogos Dupla {t} {t === myTeam && <span className="text-emerald-200/50">(sua)</span>}
            </p>
            <div className="flex flex-col gap-1.5">
              {view.melds[t].length === 0 && <span className="text-[11px] text-white/30">—</span>}
              {view.melds[t].map((m) => (
                <MeldRow
                  key={m.id}
                  m={m}
                  selectable={t === myTeam && myTurn && phase === "play"}
                  selected={selMeld === m.id}
                  onSelect={() => setSelMeld((s) => (s === m.id ? null : m.id))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* sua mão */}
      <div>
        <p className="text-[11px] text-emerald-200/70 mb-1">Sua mão ({view.your_hand.length})</p>
        <div className="flex flex-wrap gap-1.5">
          {view.your_hand.map((c) => (
            <Card key={c} card={c} selected={selected.includes(c)} onClick={() => toggleCard(c)} />
          ))}
        </div>
      </div>

      {/* ações */}
      <div className="flex flex-col gap-2 pt-1">
        {!myTurn && (
          <p className="text-center text-sm text-emerald-200/70">
            Vez de <b>{view.players.find((p) => p.is_turn)?.name ?? "—"}</b>
          </p>
        )}

        {myTurn && phase === "draw" && (
          <div className="grid grid-cols-2 gap-2">
            {view.stock_count > 0 ? (
              <button onClick={() => run(drawCard)} disabled={busy} className="btn-primary">Comprar do monte</button>
            ) : (
              <button onClick={() => run(endRound)} disabled={busy} className="btn-ghost">Encerrar (monte vazio)</button>
            )}
            <button
              onClick={() =>
                run(() =>
                  selMeld
                    ? takePile("add", [], selMeld)
                    : takePile("new", [...selected, view.discard_top!], null)
                )
              }
              disabled={busy || !view.discard_top || view.discard_locked || (!selMeld && selected.length < 2)}
              className="btn-amber"
            >
              Levar a mesa
            </button>
          </div>
        )}

        {myTurn && phase === "play" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => run(() => meldCards(selected))} disabled={busy || selected.length < 3} className="btn-primary">
              Baixar jogo
            </button>
            <button onClick={() => run(() => addToMeld(selMeld!, selected))} disabled={busy || !selMeld || selected.length < 1} className="btn-ghost">
              Encaixar
            </button>
            <button onClick={() => run(() => discardCard(selected[0]))} disabled={busy || selected.length !== 1} className="btn-ghost">
              Descartar
            </button>
            <button onClick={() => run(() => bate(selected.length === 1 ? selected[0] : null))} disabled={busy} className="btn-amber">
              Bater
            </button>
          </div>
        )}

        {myTurn && phase === "play" && (
          <p className="text-[11px] text-center text-emerald-200/50">
            Selecione cartas da mão. Toque num jogo da sua dupla para encaixar nele.
          </p>
        )}
      </div>

      {error && <ErrorBar msg={error} />}
      <style jsx global>{btnStyles}</style>
    </div>
  );
}

function ScoreHeader({ view }: { view: GameView }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex gap-3">
        {(["1", "2"] as const).map((t) => (
          <div key={t} className={`px-2.5 py-1 rounded-lg ${String(view.you.team) === t ? "bg-emerald-500/20 border border-emerald-400/30" : "bg-white/5"}`}>
            <span className="text-emerald-200/70 text-xs">Dupla {t}</span>{" "}
            <b>{view.scores[t]}</b>
            {view.scores[t] >= 2000 && <span title="na obrigada" className="text-amber-300 text-xs"> ⚠{view.obrigada[t]}</span>}
          </div>
        ))}
      </div>
      <div className="text-right text-xs text-emerald-200/70">
        Rodada {view.round}<br />meta {view.target_score}
      </div>
    </div>
  );
}

function PlayerChip({ p, myTeam }: { p: PlayerView; myTeam: number }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center border ${p.is_turn ? "bg-emerald-500/25 border-emerald-400/50" : "bg-black/25 border-white/10"}`}>
      <p className="text-xs font-medium truncate">{p.name}</p>
      <p className="text-[10px] text-emerald-200/60">
        D{p.team}{p.team === myTeam ? " 🤝" : ""} · {p.hand_count}🂠
      </p>
      {p.is_turn && <p className="text-[9px] text-emerald-300 font-bold">JOGANDO</p>}
    </div>
  );
}

function MeldRow({ m, selectable, selected, onSelect }: { m: Meld; selectable: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={selectable ? onSelect : undefined}
      className={`flex items-center gap-1 flex-wrap rounded-md p-1 transition ${
        selectable ? "cursor-pointer hover:bg-white/5" : "cursor-default"
      } ${selected ? "ring-2 ring-emerald-400 bg-emerald-500/10" : ""}`}
    >
      {m.cards.map((c, i) => (
        <Card key={c + i} card={c} small />
      ))}
      {m.is_canastra && (
        <span className={`text-[10px] font-bold ml-0.5 ${m.clean ? "text-sky-300" : "text-amber-300"}`}>
          {m.clean ? "★ CANASTRA LIMPA" : "● canastra suja"}
        </span>
      )}
    </button>
  );
}

function Card({ card, selected, onClick, small }: { card: string; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const { label, symbol, isRed, isWild } = parseCard(card);
  const size = small ? "w-7 h-10 text-[11px]" : "w-12 h-16 text-base";
  return (
    <button
      onClick={onClick}
      className={`${size} rounded-lg bg-white flex flex-col items-center justify-center font-bold shadow border transition select-none
        ${isWild ? "ring-2 ring-purple-400" : "border-gray-300"}
        ${selected ? "-translate-y-2 ring-2 ring-emerald-500" : ""}
        ${isRed ? "text-red-600" : "text-gray-900"}`}
    >
      <span className="leading-none">{label}</span>
      <span className="leading-none">{symbol}</span>
    </button>
  );
}

function Breakdown({ b }: { b: Record<string, number> }) {
  const labels: Record<string, string> = {
    melds: "Jogos", canastras: "Canastras", red3: "3 vermelho", bater: "Bater", captura: "Captura", penalidade: "Penalidade",
  };
  return (
    <div className="text-[11px] text-emerald-100/80 space-y-0.5">
      {Object.entries(labels).map(([k, lbl]) =>
        b[k] !== undefined && b[k] !== 0 ? (
          <div key={k} className="flex justify-between">
            <span>{lbl}</span>
            <span className={k === "penalidade" ? "text-red-300" : ""}>
              {k === "penalidade" ? `-${b[k]}` : `+${b[k]}`}
            </span>
          </div>
        ) : null
      )}
    </div>
  );
}

function ErrorBar({ msg }: { msg: string }) {
  return <p className="text-sm text-center text-red-200 bg-red-500/15 rounded-lg px-3 py-2">{msg}</p>;
}

const btnStyles = `
  .btn-primary{ background:#10b981; color:#04261b; font-weight:600; border-radius:.75rem; padding:.7rem; }
  .btn-primary:disabled{ opacity:.4; }
  .btn-ghost{ background:rgba(255,255,255,.1); color:#fff; font-weight:600; border-radius:.75rem; padding:.7rem; }
  .btn-ghost:disabled{ opacity:.35; }
  .btn-amber{ background:#f59e0b; color:#3a2503; font-weight:700; border-radius:.75rem; padding:.7rem; }
  .btn-amber:disabled{ opacity:.35; }
`;
