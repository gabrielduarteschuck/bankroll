"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import { normalizeAffiliateLink } from "@/lib/affiliateLinks";
import { NBA_LOGOS } from "@/components/nba-logos";

type Toast = { type: "success" | "error"; message: string } | null;

const ESPORTES = [
  "Futebol",
  "Basquete (NBA)",
  "Tênis",
  "Vôlei",
  "Futebol Americano (NFL)",
  "MMA",
  "Fórmula 1",
  "Beisebol (MLB)",
  "Hóquei no Gelo (NHL)",
  "eSports",
] as const;

type AiSuggestionRow = {
  id: string;
  esporte: string;
  mercado: string;
  descricao: string;
  odd: number;
  confianca_percent: number;
  link_bilhete_final: string | null;
  home_team: string | null;
  away_team: string | null;
  is_archived: boolean;
  created_at: string;
};

function toOddNumber(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function AdminEntradasPublicadasPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-900/40" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [items, setItems] = useState<AiSuggestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // modal
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [esporte, setEsporte] = useState<string>("");
  const [homeTeam, setHomeTeam] = useState<string>("");
  const [awayTeam, setAwayTeam] = useState<string>("");
  const [mercado, setMercado] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [odd, setOdd] = useState<string>("");
  const [confianca, setConfianca] = useState<number>(70);
  const [linkBilhete, setLinkBilhete] = useState<string>("");

  const teamOptions = useMemo(() => Object.keys(NBA_LOGOS).sort((a, b) => a.localeCompare(b)), []);

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
        console.error("Erro ao verificar admin (entradas-publicadas):", err);
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
      const { data, error: err } = await supabase
        .from("ai_suggestions")
        .select(
          "id, esporte, mercado, descricao, odd, confianca_percent, link_bilhete_final, home_team, away_team, is_archived, created_at"
        )
        .order("created_at", { ascending: false });

      if (err) {
        setError("Erro ao carregar entradas publicadas.");
        setItems([]);
        return;
      }

      setItems((data || []) as AiSuggestionRow[]);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(row: AiSuggestionRow) {
    setEditingId(row.id);
    setEsporte(row.esporte || "");
    setMercado(row.mercado || "");
    setDescricao(row.descricao || "");
    setOdd(Number.isFinite(Number(row.odd)) ? String(row.odd) : "");
    setConfianca(Number.isFinite(Number(row.confianca_percent)) ? Number(row.confianca_percent) : 70);
    setLinkBilhete(row.link_bilhete_final || "");
    setHomeTeam(String(row.home_team || "").trim().toLowerCase());
    setAwayTeam(String(row.away_team || "").trim().toLowerCase());
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setEditingId(null);
  }

  const validationError = useMemo(() => {
    if (!editingId) return "Selecione uma entrada para editar.";
    if (!esporte) return "Selecione um esporte.";
    if (!mercado.trim()) return "Informe o mercado.";
    if (!descricao.trim()) return "Informe a descrição da análise.";
    const oddNum = toOddNumber(odd);
    if (!Number.isFinite(oddNum) || oddNum <= 1) return "Odd inválida (deve ser maior que 1).";
    if (!Number.isFinite(confianca) || confianca < 20 || confianca > 100) return "Confiança inválida (20 a 100).";
    return null;
  }, [confianca, descricao, editingId, esporte, mercado, odd]);

  async function saveEdit() {
    const err = validationError;
    if (err) {
      setToast({ type: "error", message: err });
      return;
    }

    if (!editingId) return;

    setSaving(true);
    try {
      const homeTeamClean = String(homeTeam || "").trim().toLowerCase();
      const awayTeamClean = String(awayTeam || "").trim().toLowerCase();

      const payload: any = {
        esporte,
        mercado: mercado.trim(),
        descricao: descricao.trim(),
        odd: toOddNumber(odd),
        confianca_percent: confianca,
        link_bilhete_final: linkBilhete.trim() ? normalizeAffiliateLink(linkBilhete.trim()) : null,
        home_team: homeTeamClean ? homeTeamClean : null,
        away_team: awayTeamClean ? awayTeamClean : null,
      };

      const { error: updErr } = await supabase.from("ai_suggestions").update(payload).eq("id", editingId);
      if (updErr) {
        setToast({ type: "error", message: "Erro ao salvar alterações." });
        return;
      }

      setToast({ type: "success", message: "✅ Alterações salvas!" });
      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(id: string) {
    const ok = window.confirm("Excluir esta publicação? Essa ação não pode ser desfeita.");
    if (!ok) return;

    setSaving(true);
    try {
      const { error: delErr } = await supabase.from("ai_suggestions").delete().eq("id", id);
      if (delErr) {
        setToast({ type: "error", message: "Erro ao excluir publicação." });
        return;
      }
      setToast({ type: "success", message: "✅ Publicação excluída." });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function restoreItem(id: string) {
    setSaving(true);
    try {
      const { error: restoreErr } = await supabase
        .from("ai_suggestions")
        .update({ is_archived: false })
        .eq("id", id);

      if (restoreErr) {
        setToast({ type: "error", message: "Erro ao restaurar publicação." });
        return;
      }
      setToast({ type: "success", message: "Sugestão restaurada e visível para usuários!" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="space-y-6">
        <div className={`h-7 w-64 rounded-lg animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-4 w-96 rounded animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
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

      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Entradas publicadas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Edite ou exclua publicações existentes (conteúdo editorial).
        </p>
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
      ) : loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-20 rounded-2xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`rounded-2xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-950" : "bg-white"} p-6 shadow-sm`}>
          <div className={`text-sm ${textSecondary}`}>Nenhuma publicação ainda.</div>
          <div className={`mt-1 text-xs ${textTertiary}`}>Crie uma análise em “Análises da IA”.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((row) => (
            <div
              key={row.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                theme === "dark" ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
              } ${row.is_archived ? "opacity-70" : ""}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`text-sm font-semibold ${textPrimary}`}>
                      {row.esporte} • {row.mercado}
                    </div>
                    {row.is_archived && (
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                        theme === "dark" ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                      }`}>
                        Arquivada
                      </span>
                    )}
                  </div>
                  <div className={`mt-1 text-xs ${textTertiary}`}>
                    {formatDateTimeBR(row.created_at) ? `Criado em ${formatDateTimeBR(row.created_at)}` : ""}
                  </div>
                  <div className={`mt-2 text-sm ${textSecondary} line-clamp-2`}>{row.descricao}</div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex gap-2">
                    {row.is_archived ? (
                      <button
                        type="button"
                        onClick={() => restoreItem(row.id)}
                        disabled={saving}
                        className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                          theme === "dark"
                            ? "bg-amber-600 text-white hover:bg-amber-500"
                            : "bg-amber-600 text-white hover:bg-amber-700"
                        }`}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        disabled={saving}
                        className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                          theme === "dark"
                            ? "bg-zinc-900 text-white border border-zinc-800 hover:bg-zinc-800"
                            : "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        Editar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(row.id)}
                      disabled={saving}
                      className={`h-10 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                        theme === "dark"
                          ? "bg-red-900/20 text-red-200 border border-red-800 hover:bg-red-900/30"
                          : "bg-red-50 text-red-800 border border-red-200 hover:bg-red-100"
                      }`}
                    >
                      Excluir
                    </button>
                  </div>

                  <div className={`text-xs ${textTertiary}`}>
                    Odd: <span className={`font-semibold ${textPrimary}`}>{Number(row.odd).toFixed(2)}</span>{" "}
                    • Confianca:{" "}
                    <span className={`${theme === "dark" ? "text-emerald-200" : "text-emerald-700"} font-semibold`}>
                      {row.confianca_percent}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div
            className={`relative w-full max-w-2xl rounded-3xl border p-5 sm:p-6 shadow-2xl ${
              theme === "dark" ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className={`text-lg font-semibold ${textPrimary}`}>Editar publicação</div>
                <div className={`mt-1 text-xs ${textTertiary}`}>Altere campos e salve.</div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  theme === "dark" ? "text-zinc-300 hover:bg-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Esporte</label>
                <select
                  value={esporte}
                  onChange={(e) => setEsporte(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none`}
                >
                  <option value="">Selecione</option>
                  {ESPORTES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Time Visitante</label>
                <select
                  value={awayTeam}
                  onChange={(e) => setAwayTeam(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none`}
                >
                  <option value="">Selecione</option>
                  {teamOptions.map((k) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Time da Casa</label>
                <select
                  value={homeTeam}
                  onChange={(e) => setHomeTeam(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none`}
                >
                  <option value="">Selecione</option>
                  {teamOptions.map((k) => (
                    <option key={k} value={k}>
                      {k.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Odd</label>
                <input
                  value={odd}
                  onChange={(e) => setOdd(e.target.value.replace(/[^\d,.-]/g, ""))}
                  inputMode="decimal"
                  placeholder="Ex: 1.95"
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Mercado</label>
                <input
                  value={mercado}
                  onChange={(e) => setMercado(e.target.value)}
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Descrição da análise</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={5}
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <label className={`block text-sm font-medium ${textSecondary}`}>Confiança (%)</label>
                  <div className={`text-sm font-semibold ${theme === "dark" ? "text-emerald-200" : "text-emerald-700"}`}>
                    {confianca}%
                  </div>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={confianca}
                  onChange={(e) => setConfianca(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Link do bilhete compartilhado</label>
                <input
                  value={linkBilhete}
                  onChange={(e) => setLinkBilhete(e.target.value)}
                  onBlur={() => {
                    const v = linkBilhete.trim();
                    if (!v) return;
                    const normalized = normalizeAffiliateLink(v);
                    if (normalized && normalized !== v) setLinkBilhete(normalized);
                  }}
                  placeholder="https://..."
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                />
                <div className={`mt-2 text-xs ${textTertiary}`}>Opcional. Use apenas links públicos.</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {validationError ? (
                <div className={`text-sm ${theme === "dark" ? "text-red-300" : "text-red-700"}`}>
                  {validationError}
                </div>
              ) : (
                <div className={`text-sm ${textTertiary}`}>Pronto para salvar alterações.</div>
              )}

              <button
                type="button"
                onClick={saveEdit}
                disabled={saving || !!validationError}
                className={`h-12 px-6 rounded-xl font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                }`}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

