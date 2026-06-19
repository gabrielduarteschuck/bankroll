"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRoom, joinRoom } from "@/lib/canastra";

export default function CanastraHome() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) return setError("Digite seu nome");
    setLoading(true);
    try {
      const res = await createRoom(name.trim());
      router.push(`/canastra/sala/${res.room_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar mesa");
      setLoading(false);
    }
  }

  async function handleJoin() {
    setError(null);
    if (!name.trim()) return setError("Digite seu nome");
    if (!code.trim()) return setError("Digite o código da mesa");
    setLoading(true);
    try {
      const res = await joinRoom(code.trim(), name.trim());
      router.push(`/canastra/sala/${res.room_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao entrar na mesa");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-b from-emerald-950 via-green-900 to-emerald-950 text-white">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🃏</div>
          <h1 className="text-3xl font-bold tracking-tight">Canastra Suja</h1>
          <p className="text-emerald-200/80 text-sm mt-1">em dupla • só com a turma</p>
        </div>

        <div className="bg-black/25 backdrop-blur rounded-2xl p-6 shadow-2xl border border-white/10">
          {mode === "menu" && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setMode("create"); setError(null); }}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 transition py-3.5 font-semibold text-emerald-950"
              >
                Criar mesa
              </button>
              <button
                onClick={() => { setMode("join"); setError(null); }}
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 transition py-3.5 font-semibold"
              >
                Entrar com código
              </button>
            </div>
          )}

          {mode !== "menu" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-emerald-200/80 mb-1.5">
                  Seu nome
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você aparece na mesa"
                  maxLength={20}
                  autoFocus
                  className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400"
                />
              </div>

              {mode === "join" && (
                <div>
                  <label className="block text-xs font-medium text-emerald-200/80 mb-1.5">
                    Código da mesa
                  </label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Ex: K7P2M"
                    maxLength={5}
                    className="w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-white tracking-[0.3em] text-center text-lg font-mono placeholder:tracking-normal placeholder:text-white/30 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                onClick={mode === "create" ? handleCreate : handleJoin}
                disabled={loading}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition py-3.5 font-semibold text-emerald-950"
              >
                {loading ? "..." : mode === "create" ? "Criar mesa" : "Entrar"}
              </button>
              <button
                onClick={() => { setMode("menu"); setError(null); }}
                className="text-sm text-emerald-200/60 hover:text-emerald-200"
              >
                ← voltar
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
