"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type Toast = { type: "success" | "error"; message: string } | null;

type AiSuggestionRow = {
  id: string;
  esporte: string;
  mercado: string;
  odd: number;
  confianca_percent: number;
  created_at: string;
};

type ClickAggRow = {
  suggestion_id: string;
  clicks: number;
};

function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AdminRelatoriosPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  const [totalClicks, setTotalClicks] = useState<number>(0);
  const [items, setItems] = useState<Array<AiSuggestionRow & { clicks: number }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void (async () => {
      setChecking(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/dashboard");
          return;
        }

        let ok = false;
        const { data: isAdminRpc, error: rpcErr } = await supabase.rpc("is_admin", {
          user_id: user.id,
        });

        if (!rpcErr && isAdminRpc === true) {
          ok = true;
        } else {
          const { data: profile, error: profileErr } = await supabase
            .from("profiles")
            .select("is_admin, role")
            .eq("id", user.id)
            .single();

          if (profileErr) {
            router.replace("/dashboard");
            return;
          }

          ok = profile?.is_admin === true || profile?.role === "admin";
        }

        setIsAdmin(ok);
        if (!ok) router.replace("/dashboard");
      } catch (err: any) {
        const name = String(err?.name || "");
        const msg = String(err?.message || "");
        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) return;
        console.error("Erro ao verificar admin (relatorios admin):", err);
        router.replace("/dashboard");
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [totalRes, reportRes, sugRes] = await Promise.all([
        supabase.rpc("ai_suggestion_clicks_total"),
        supabase.rpc("ai_suggestion_clicks_report"),
        supabase
          .from("ai_suggestions")
          .select("id, esporte, mercado, odd, confianca_percent, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (totalRes.error || reportRes.error) {
        setError("Relatórios de cliques indisponíveis. Aplique a migration de cliques no Supabase.");
        setTotalClicks(0);
        setItems([]);
        return;
      }

      const total = Number(totalRes.data) || 0;
      setTotalClicks(total);

      const rows = (reportRes.data || []) as ClickAggRow[];
      const clicksMap: Record<string, number> = {};
      for (const r of rows) clicksMap[String(r.suggestion_id)] = Number(r.clicks) || 0;

      if (sugRes.error) {
        setError("Erro ao carregar sugestões.");
        setItems([]);
        return;
      }

      const base = (sugRes.data || []) as AiSuggestionRow[];
      const merged = base.map((s) => ({
        ...s,
        clicks: clicksMap[String(s.id)] || 0,
      }));

      merged.sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks;
        return String(b.created_at).localeCompare(String(a.created_at));
      });

      setItems(merged);
    } finally {
      setLoading(false);
    }
  }

  const topClicks = useMemo(() => items.slice(0, 50), [items]);

  if (checking) {
    return (
      <div className="space-y-6">
        <div className={`h-7 w-48 rounded-lg animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-4 w-80 rounded animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-64 rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? theme === "dark"
                  ? "bg-emerald-900/20 border-emerald-800 text-emerald-200"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : theme === "dark"
                  ? "bg-red-900/20 border-red-800 text-red-200"
                  : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Relatórios</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>
            Métricas editoriais do botão CTA (cliques por sugestão).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
            theme === "dark"
              ? "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800"
              : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50"
          }`}
        >
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {error ? (
        <div
          className={`rounded-2xl border p-6 shadow-sm ${
            theme === "dark"
              ? "border-red-800 bg-red-900/20 text-red-200"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {error}
        </div>
      ) : (
        <div
          className={`rounded-3xl border p-6 shadow-sm ${
            theme === "dark" ? "border-emerald-500/20 bg-zinc-950" : "border-emerald-200 bg-white"
          }`}
        >
          <div className={`text-xs font-semibold uppercase tracking-wider ${
            theme === "dark" ? "text-emerald-200/90" : "text-emerald-800"
          }`}>
            Total de cliques
          </div>
          <div className={`mt-2 text-3xl font-bold ${textPrimary} tabular-nums`}>{totalClicks}</div>
          <div className={`mt-1 text-xs ${textTertiary}`}>Soma de todos os cliques no CTA.</div>
        </div>
      )}

      <div className={`rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-950" : "bg-white"} p-4 sm:p-6`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-sm font-semibold ${textPrimary}`}>Sugestões mais clicadas</div>
            <div className={`mt-1 text-xs ${textTertiary}`}>Ordenado por cliques (desc).</div>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`h-14 rounded-2xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-zinc-50"} animate-pulse`}
              />
            ))}
          </div>
        ) : topClicks.length === 0 ? (
          <div className={`mt-4 text-sm ${textSecondary}`}>Sem dados ainda.</div>
        ) : (
          <div className="mt-4 divide-y divide-zinc-800/40">
            {topClicks.map((s) => (
              <div key={s.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className={`text-sm font-semibold ${textPrimary}`}>
                    {s.esporte} • {s.mercado}
                  </div>
                  <div className={`mt-1 text-xs ${textTertiary}`}>
                    {formatDateTimeBR(s.created_at) ? `Criado em ${formatDateTimeBR(s.created_at)}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-xs ${textTertiary}`}>Cliques</div>
                  <div className={`text-lg font-bold ${textPrimary} tabular-nums`}>{s.clicks}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

