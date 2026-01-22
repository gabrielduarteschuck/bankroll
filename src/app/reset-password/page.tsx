"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function parseUrlParams(): { type: string | null; accessToken: string | null; refreshToken: string | null } {
  // Alguns provedores mandam no query (?access_token=...),
  // outros no hash (#access_token=...&refresh_token=...).
  const search = new URLSearchParams(window.location.search);
  const hashRaw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hash = new URLSearchParams(hashRaw);

  const type = search.get("type") || hash.get("type");
  const accessToken = search.get("access_token") || hash.get("access_token");
  const refreshToken = search.get("refresh_token") || hash.get("refresh_token");

  return { type, accessToken, refreshToken };
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { type, accessToken, refreshToken } = parseUrlParams();

        // Requisito: só permitir quando vier do fluxo de recovery
        if (type !== "recovery") {
          router.replace("/login");
          return;
        }

        // Requisito do usuário: ler tokens via query.
        // Na prática, o Supabase quase sempre precisa do refresh_token também para setSession.
        if (!accessToken) {
          setError("Link inválido ou incompleto. Solicite novamente a recuperação de senha.");
          setReady(false);
          return;
        }

        if (!refreshToken) {
          setError("Link inválido ou expirado. Solicite novamente a recuperação de senha.");
          setReady(false);
          return;
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setErr) {
          setError("Link inválido ou expirado. Solicite novamente a recuperação de senha.");
          setReady(false);
          return;
        }

        // remove tokens da URL
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {
          // noop
        }

        if (!cancelled) setReady(true);
      } catch (err: any) {
        if (!cancelled) {
          setError("Erro ao validar link. Solicite novamente a recuperação de senha.");
          setReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const validationError = useMemo(() => {
    if (!password.trim()) return "Informe a nova senha.";
    if (password.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    if (password !== confirmPassword) return "As senhas não coincidem.";
    return null;
  }, [confirmPassword, password]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const v = validationError;
    if (v) {
      setError(v);
      return;
    }

    setSaving(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError("Não foi possível alterar a senha. Tente novamente.");
        return;
      }

      // encerra sessão e volta ao login com mensagem
      await supabase.auth.signOut();
      router.replace("/login?reset=1");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
        <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ProStake" className="h-9 w-9" />
            <div>
              <div className="text-lg font-semibold">Redefinir senha</div>
              <div className="text-sm text-zinc-600">Crie uma nova senha para sua conta.</div>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              Validando link...
            </div>
          ) : !ready ? (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error || "Link inválido ou expirado."}
            </div>
          ) : (
            <form onSubmit={handleSave} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-600">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="********"
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                />
                <p className="text-xs text-zinc-500">Mínimo de 6 caracteres.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-600">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="********"
                  className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                />
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !!validationError}
                className="w-full rounded-2xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

