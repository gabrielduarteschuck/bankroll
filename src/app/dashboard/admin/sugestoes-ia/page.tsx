"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type SugestaoIA = {
  id: string;
  created_at: string;
  published_at: string | null;
  is_published: boolean;
  titulo: string;
  esporte: string;
  evento: string;
  mercado: string;
  odd: number;
  confianca_pct: number;
  resumo: string;
  tags: string[] | null;
  link_casa: string | null;
};

type FormState = {
  id?: string;
  titulo: string;
  esporte: string;
  evento: string;
  mercado: string;
  odd: string;
  confianca_pct: string;
  resumo: string;
  tags: string;
  link_casa: string;
};

function toNum(v: unknown): number {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v)
        : Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

export default function AdminSugestoesIAPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loadingList, setLoadingList] = useState(true);
  const [items, setItems] = useState<SugestaoIA[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm: FormState = useMemo(
    () => ({
      titulo: "",
      esporte: "",
      evento: "",
      mercado: "",
      odd: "",
      confianca_pct: "",
      resumo: "",
      tags: "",
      link_casa: "",
    }),
    []
  );

  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    void (async () => {
      setCheckingAccess(true);
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
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_admin, role")
            .eq("id", user.id)
            .single();

          if (error) {
            router.replace("/dashboard");
            return;
          }

          ok = profile?.is_admin === true || profile?.role === "admin";
        }

        setIsAdmin(ok);
        if (!ok) {
          router.replace("/dashboard");
          return;
        }

        await loadSugestoes();
      } catch (err: any) {
        const name = String(err?.name || "");
        const msg = String(err?.message || "");
        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) {
          return;
        }
        console.error("Erro ao verificar admin (sugestoes-ia):", err);
        router.replace("/dashboard");
      } finally {
        setCheckingAccess(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSugestoes() {
    setLoadingList(true);
    setListError(null);
    try {
      const { data, error } = await supabase
        .from("sugestoes_ia")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        const msg = String(error.message || "");
        if (msg.toLowerCase().includes("sugestoes_ia")) {
          setListError(
            "Tabela de sugestões ainda não foi criada. Aplique a migration do Supabase para public.sugestoes_ia."
          );
        } else {
          setListError("Erro ao carregar sugestões.");
        }
        setItems([]);
        return;
      }

      setItems((data || []) as SugestaoIA[]);
    } finally {
      setLoadingList(false);
    }
  }

  function openNew() {
    setFormError(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  }

  function openEdit(s: SugestaoIA) {
    setFormError(null);
    setForm({
      id: s.id,
      titulo: s.titulo || "",
      esporte: s.esporte || "",
      evento: s.evento || "",
      mercado: s.mercado || "",
      odd: String(s.odd ?? ""),
      confianca_pct: String(s.confianca_pct ?? ""),
      resumo: s.resumo || "",
      tags: Array.isArray(s.tags) ? s.tags.join(", ") : "",
      link_casa: s.link_casa || "",
    });
    setModalOpen(true);
  }

  function validateForm(): string | null {
    if (!form.titulo.trim()) return "Informe o título.";
    if (!form.esporte.trim()) return "Informe o esporte.";
    if (!form.evento.trim()) return "Informe o evento.";
    if (!form.mercado.trim()) return "Informe o mercado.";
    const odd = parseFloat(form.odd.replace(",", "."));
    if (!Number.isFinite(odd) || odd <= 1) return "Odd inválida (deve ser maior que 1).";
    const conf = parseInt(form.confianca_pct, 10);
    if (!Number.isFinite(conf) || conf < 0 || conf > 100) return "Confiança inválida (0 a 100).";
    if (!form.resumo.trim()) return "Informe o resumo.";
    return null;
  }

  function parseTags(v: string): string[] {
    return v
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function handleSave() {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setFormError("Usuário não autenticado.");
        return;
      }

      const payload: any = {
        titulo: form.titulo.trim(),
        esporte: form.esporte.trim(),
        evento: form.evento.trim(),
        mercado: form.mercado.trim(),
        odd: parseFloat(form.odd.replace(",", ".")),
        confianca_pct: parseInt(form.confianca_pct, 10),
        resumo: form.resumo.trim(),
        tags: parseTags(form.tags),
        link_casa: form.link_casa.trim() ? form.link_casa.trim() : null,
        created_by: user.id,
      };

      if (form.id) {
        const { error } = await supabase
          .from("sugestoes_ia")
          .update(payload)
          .eq("id", form.id);
        if (error) {
          setFormError("Erro ao salvar sugestão.");
          return;
        }
      } else {
        const { error } = await supabase.from("sugestoes_ia").insert(payload);
        if (error) {
          setFormError("Erro ao criar sugestão.");
          return;
        }
      }

      setModalOpen(false);
      await loadSugestoes();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(s: SugestaoIA) {
    setTogglingId(s.id);
    try {
      const next = !s.is_published;
      const payload = next
        ? { is_published: true, published_at: new Date().toISOString() }
        : { is_published: false, published_at: null };

      const { error } = await supabase.from("sugestoes_ia").update(payload).eq("id", s.id);
      if (error) {
        alert("Erro ao publicar/despublicar.");
        return;
      }
      await loadSugestoes();
    } finally {
      setTogglingId(null);
    }
  }

  async function removeItem(s: SugestaoIA) {
    const ok = confirm("Excluir esta sugestão? Esta ação não pode ser desfeita.");
    if (!ok) return;

    setDeletingId(s.id);
    try {
      const { error } = await supabase.from("sugestoes_ia").delete().eq("id", s.id);
      if (error) {
        alert("Erro ao excluir sugestão.");
        return;
      }
      await loadSugestoes();
    } finally {
      setDeletingId(null);
    }
  }

  if (checkingAccess) {
    return (
      <div className="space-y-6">
        <div className={`h-7 w-64 rounded-lg animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-4 w-96 rounded animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-28 rounded-2xl border ${cardBorder} ${cardBg} animate-pulse`} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Sugestões da IA (Admin)</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>
            Crie, edite e publique sugestões para os usuários.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className={`h-11 px-5 rounded-lg font-semibold cursor-pointer transition-colors ${
            theme === "dark"
              ? "bg-zinc-700 text-white hover:bg-zinc-600"
              : "bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          Nova sugestão
        </button>
      </div>

      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className={`text-sm font-semibold ${textPrimary}`}>Sugestões</div>
          <button
            type="button"
            onClick={loadSugestoes}
            disabled={loadingList}
            className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              theme === "dark"
                ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {loadingList ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {listError ? (
          <div className={`rounded-xl border px-4 py-3 text-sm ${
            theme === "dark"
              ? "border-red-800 bg-red-900/20 text-red-200"
              : "border-red-200 bg-red-50 text-red-800"
          }`}>
            {listError}
          </div>
        ) : loadingList ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`h-16 rounded-xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-800/40" : "bg-zinc-50"} animate-pulse`}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={`text-sm ${textSecondary}`}>Nenhuma sugestão cadastrada.</div>
        ) : (
          <div className="space-y-3">
            {items.map((s) => {
              const statusLabel = s.is_published ? "Publicada" : "Rascunho";
              const statusCls = s.is_published
                ? theme === "dark"
                  ? "border-green-800 bg-green-900/20 text-green-200"
                  : "border-green-200 bg-green-50 text-green-700"
                : theme === "dark"
                  ? "border-zinc-800 bg-zinc-800/40 text-zinc-200"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700";

              return (
                <div
                  key={s.id}
                  className={`rounded-xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-950/20" : "bg-white"} p-4`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`font-semibold ${textPrimary} truncate`}>{s.titulo}</div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCls}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className={`mt-1 text-xs ${textSecondary}`}>
                        <span className="font-semibold">{s.esporte}</span>
                        <span className="mx-2">•</span>
                        <span>Odd: {toNum(s.odd).toFixed(2)}</span>
                        <span className="mx-2">•</span>
                        <span>Confiança: {toNum(s.confianca_pct)}%</span>
                      </div>
                      <div className={`mt-2 text-xs ${textTertiary} line-clamp-2`}>
                        {s.resumo}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                          theme === "dark"
                            ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePublish(s)}
                        disabled={togglingId === s.id}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          s.is_published
                            ? theme === "dark"
                              ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            : theme === "dark"
                              ? "bg-green-700 text-white hover:bg-green-600"
                              : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        {togglingId === s.id
                          ? "Aguarde..."
                          : s.is_published
                            ? "Despublicar"
                            : "Publicar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(s)}
                        disabled={deletingId === s.id}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          theme === "dark"
                            ? "bg-red-900/20 text-red-200 hover:bg-red-900/30 border border-red-800"
                            : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                        }`}
                      >
                        {deletingId === s.id ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => (saving ? null : setModalOpen(false))}
          />
          <div className={`relative w-full max-w-2xl rounded-2xl border ${cardBorder} ${cardBg} shadow-xl`}>
            <div className="flex items-start justify-between gap-4 border-b px-6 py-4"
              style={{ borderColor: theme === "dark" ? "#27272a" : "#e4e4e7" }}
            >
              <div>
                <div className={`text-lg font-semibold ${textPrimary}`}>
                  {form.id ? "Editar sugestão" : "Nova sugestão"}
                </div>
                <div className={`mt-1 text-xs ${textSecondary}`}>
                  Preencha os dados e publique quando estiver pronto.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className={`rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer transition-colors disabled:opacity-60 ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Fechar
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${
                  theme === "dark"
                    ? "border-red-800 bg-red-900/20 text-red-200"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}>
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Título</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: Over com valor na rodada"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Esporte</label>
                  <input
                    value={form.esporte}
                    onChange={(e) => setForm((p) => ({ ...p, esporte: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: Futebol"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Odd</label>
                  <input
                    value={form.odd}
                    onChange={(e) => setForm((p) => ({ ...p, odd: e.target.value.replace(/[^\d,.-]/g, "") }))}
                    inputMode="decimal"
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: 1.95"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Evento</label>
                  <input
                    value={form.evento}
                    onChange={(e) => setForm((p) => ({ ...p, evento: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: Real Madrid x Sevilla"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Mercado</label>
                  <input
                    value={form.mercado}
                    onChange={(e) => setForm((p) => ({ ...p, mercado: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: Over 2.5"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Confiança (%)</label>
                  <input
                    value={form.confianca_pct}
                    onChange={(e) => setForm((p) => ({ ...p, confianca_pct: e.target.value.replace(/[^\d]/g, "").slice(0, 3) }))}
                    inputMode="numeric"
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="0 a 100"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Tags</label>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Ex: valor, estatística, underdog"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Link da casa (opcional)</label>
                  <input
                    value={form.link_casa}
                    onChange={(e) => setForm((p) => ({ ...p, link_casa: e.target.value }))}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="https://..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Resumo</label>
                  <textarea
                    value={form.resumo}
                    onChange={(e) => setForm((p) => ({ ...p, resumo: e.target.value }))}
                    rows={4}
                    className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    placeholder="Texto curto estilo jornalista, direto e objetivo."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end"
              style={{ borderColor: theme === "dark" ? "#27272a" : "#e4e4e7" }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className={`h-11 px-5 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`h-11 px-5 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-zinc-700 text-white hover:bg-zinc-600"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

