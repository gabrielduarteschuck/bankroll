"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchPlayers,
  fetchRoomByCode,
  getStoredPlayerId,
  joinRoom,
  subscribeRoom,
  type Player,
  type Room,
} from "@/lib/canastra";

export default function CanastraLobby() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = (params?.code ?? "").toUpperCase();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetchRoomByCode(code);
    if (!r) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setRoom(r);
    setPlayers(await fetchPlayers(r.id));
    setMeId(getStoredPlayerId(code));
    setLoading(false);
    return r;
  }, [code]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const r = await reload();
      if (r) unsub = subscribeRoom(r.id, () => void reload());
    })();
    return () => unsub?.();
  }, [reload]);

  const isMember = !!meId && players.some((p) => p.id === meId);

  async function handleJoin() {
    setError(null);
    if (!joinName.trim()) return setError("Digite seu nome");
    setJoining(true);
    try {
      await joinRoom(code, joinName.trim());
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao entrar");
    } finally {
      setJoining(false);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ----- estados de carregamento / erro -----
  if (loading) {
    return (
      <Shell>
        <p className="text-emerald-200/70 text-center animate-pulse">Carregando mesa...</p>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-4xl mb-3">🤔</div>
          <p className="font-semibold mb-1">Mesa não encontrada</p>
          <p className="text-sm text-emerald-200/70 mb-5">O código <b>{code}</b> não existe.</p>
          <button onClick={() => router.push("/canastra")} className="rounded-xl bg-emerald-500 text-emerald-950 px-5 py-2.5 font-semibold">
            Voltar
          </button>
        </div>
      </Shell>
    );
  }

  // ----- entrar via link (não é membro ainda) -----
  if (!isMember) {
    const full = players.length >= 4;
    return (
      <Shell>
        <div className="text-center mb-5">
          <p className="text-sm text-emerald-200/70">Mesa</p>
          <p className="text-2xl font-bold font-mono tracking-widest">{code}</p>
        </div>
        {full ? (
          <p className="text-center text-amber-200 bg-amber-500/10 rounded-lg px-3 py-2 text-sm">
            Mesa cheia (4/4). Aguarde abrir uma vaga.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Seu nome na mesa"
              maxLength={20}
              autoFocus
              className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400"
            />
            {error && <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition py-3.5 font-semibold text-emerald-950"
            >
              {joining ? "..." : "Entrar na mesa"}
            </button>
          </div>
        )}
      </Shell>
    );
  }

  // ----- lobby (sou membro) -----
  const teamsDrawn = players.length === 4 && players.every((p) => p.seat != null);
  const seatsOrder = teamsDrawn
    ? [...players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    : players;

  return (
    <Shell>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-emerald-200/70">Código da mesa</p>
          <p className="text-2xl font-bold font-mono tracking-widest">{code}</p>
        </div>
        <button
          onClick={copyCode}
          className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm font-medium"
        >
          {copied ? "✓ Copiado" : "Copiar"}
        </button>
      </div>

      {!teamsDrawn && (
        <div className="mb-5 text-center">
          <p className="text-emerald-200/80 text-sm">Aguardando jogadores</p>
          <p className="text-3xl font-bold mt-1">{players.length}<span className="text-emerald-200/50 text-xl">/4</span></p>
          <p className="text-xs text-emerald-200/60 mt-2">Compartilhe o código acima. As duplas são sorteadas ao fechar 4.</p>
        </div>
      )}

      {teamsDrawn ? (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[1, 2].map((team) => (
            <div key={team} className="rounded-xl bg-black/25 border border-white/10 p-3">
              <p className="text-xs font-semibold text-emerald-300 mb-2">Dupla {team}</p>
              <div className="flex flex-col gap-2">
                {seatsOrder.filter((p) => p.team === team).map((p) => (
                  <PlayerChip key={p.id} player={p} me={p.id === meId} dealerSeat={room?.dealer_seat ?? null} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-5">
          {seatsOrder.map((p) => (
            <PlayerChip key={p.id} player={p} me={p.id === meId} dealerSeat={null} />
          ))}
          {Array.from({ length: 4 - players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-white/30 text-sm">
              Vaga aberta...
            </div>
          ))}
        </div>
      )}

      {teamsDrawn && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-4 text-center">
          <p className="text-emerald-200 font-semibold">Duplas sorteadas! 🎉</p>
          <p className="text-xs text-emerald-200/70 mt-1">
            Distribuição das cartas chega na <b>Etapa 2</b>.
          </p>
          {players.find((p) => p.id === meId)?.is_host && (
            <button
              disabled
              className="mt-3 w-full rounded-xl bg-white/10 py-3 font-semibold text-white/40 cursor-not-allowed"
            >
              Iniciar partida (em breve)
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

function PlayerChip({ player, me, dealerSeat }: { player: Player; me: boolean; dealerSeat: number | null }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${me ? "bg-emerald-500/20 border border-emerald-400/40" : "bg-black/30 border border-white/10"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-medium">{player.name}</span>
        {me && <span className="text-[10px] bg-emerald-400 text-emerald-950 rounded px-1.5 py-0.5 font-bold">VOCÊ</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {player.is_host && <span title="Anfitrião">👑</span>}
        {dealerSeat != null && player.seat === dealerSeat && (
          <span className="text-[10px] bg-amber-400 text-amber-950 rounded px-1.5 py-0.5 font-bold">EMBARALHA</span>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-emerald-950 via-green-900 to-emerald-950 text-white">
      <div className="w-full max-w-sm bg-black/25 backdrop-blur rounded-2xl p-6 shadow-2xl border border-white/10">
        {children}
      </div>
    </main>
  );
}
