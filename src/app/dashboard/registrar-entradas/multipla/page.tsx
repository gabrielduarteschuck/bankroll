"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type MultiplaItem = {
  id: string;
  esporte: string; // esporte selecionado (ou "outros")
  esporteCustom: string; // quando esporte === "outros"
  evento: string;
  mercado: string;
  odd: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

function toOddNumber(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function toUnidadesNumber(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function RegistrarMultiplaPage() {
  const router = useRouter();
  const { theme } = useTheme();

  // 10 esportes mais comuns (ordem de uso), + opção "Outro" (mesmo do Registrar Entrada simples)
  const ESPORTES_PREDEFINIDOS = [
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

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Valor da unidade
  const [valorUnidade, setValorUnidade] = useState<number>(0);
  const [loadingUnidade, setLoadingUnidade] = useState(true);

  // Campos da múltipla
  const [casa, setCasa] = useState("");
  const [tipster, setTipster] = useState("");
  const [resultado, setResultado] = useState<"pendente" | "green" | "red">("pendente");
  const [unidades, setUnidades] = useState<string>("1");
  const [showCustomUnidade, setShowCustomUnidade] = useState(false);
  const [customUnidade, setCustomUnidade] = useState("");
  const [savingStake, setSavingStake] = useState(false);
  const [customStakes, setCustomStakes] = useState<number[]>([]);

  // Stakes pré-definidas (base)
  const UNIDADES_BASE = [0.2, 0.5, 1, 2, 5];

  // Combina base + customizadas, remove duplicatas, ordena
  const UNIDADES_PREDEFINIDAS = useMemo(() => {
    const all = [...UNIDADES_BASE, ...customStakes];
    const unique = [...new Set(all)];
    return unique.sort((a, b) => a - b);
  }, [customStakes]);

  // Itens
  const [itens, setItens] = useState<MultiplaItem[]>([
    { id: crypto.randomUUID(), esporte: "", esporteCustom: "", evento: "", mercado: "", odd: "" },
    { id: crypto.randomUUID(), esporte: "", esporteCustom: "", evento: "", mercado: "", odd: "" },
  ]);

  // Tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";
  const infoBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-50";

  function toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Carrega stakes personalizadas do usuário
  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("stakes_personalizadas")
          .select("percent")
          .eq("user_id", user.id)
          .order("percent", { ascending: true });

        if (data && data.length > 0) {
          const stakes = data.map((s: { percent: number }) => Number(s.percent));
          setCustomStakes(stakes);
        }
      } catch {
        // ignora erro silenciosamente
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingUnidade(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Busca banca e calcula automaticamente o valor da unidade:
        // 1 Un = 1% da base (stake_base se existir; senão valor da banca)
        let bancaData:
          | {
              valor?: unknown;
              stake_base?: unknown;
              valor_unidade?: unknown;
            }
          | null = null;
        let bancaError: { message?: unknown } | null = null;

        {
          const res = await supabase
            .from("banca")
            .select("valor, stake_base, valor_unidade")
            .eq("user_id", user.id)
            .single();
          bancaData = (res.data ?? null) as unknown as
            | {
                valor?: unknown;
                stake_base?: unknown;
                valor_unidade?: unknown;
              }
            | null;
          bancaError = (res.error ?? null) as unknown as { message?: unknown } | null;
        }

        const bancaErrorMessage =
          typeof bancaError?.message === "string" ? bancaError.message.toLowerCase() : "";
        const stakeBaseMissing =
          !!bancaError && bancaErrorMessage.includes("stake_base");
        const valorUnidadeMissing =
          !!bancaError && bancaErrorMessage.includes("valor_unidade");

        if (stakeBaseMissing || valorUnidadeMissing) {
          const selectCols =
            stakeBaseMissing && valorUnidadeMissing
              ? "valor"
              : stakeBaseMissing
                ? "valor, valor_unidade"
                : "valor, stake_base";

          const res2 = await supabase
            .from("banca")
            .select(selectCols)
            .eq("user_id", user.id)
            .single();
          bancaData = (res2.data ?? null) as unknown as
            | {
                valor?: unknown;
                stake_base?: unknown;
                valor_unidade?: unknown;
              }
            | null;
          bancaError = (res2.error ?? null) as unknown as { message?: unknown } | null;
        }

        // Se não houver banca, mantém 0 para mostrar "Não definido"
        if (bancaError || !bancaData) return;

        const baseNum =
          bancaData?.stake_base !== null && bancaData?.stake_base !== undefined
            ? toNumber(bancaData.stake_base)
            : toNumber(bancaData.valor);
        const valorUnidadeSalvo =
          bancaData?.valor_unidade !== null && bancaData?.valor_unidade !== undefined
            ? toNumber(bancaData.valor_unidade)
            : 0;

        const valorUnidadeCalculado =
          valorUnidadeSalvo > 0 ? valorUnidadeSalvo : baseNum > 0 ? baseNum * 0.01 : 0;

        if (valorUnidadeCalculado > 0) {
          setValorUnidade(valorUnidadeCalculado);
        }
      } finally {
        setLoadingUnidade(false);
      }
    })();
  }, []);

  const oddCombinada = useMemo(() => {
    const odds = itens
      .map((i) => toOddNumber(i.odd))
      .filter((n) => Number.isFinite(n) && n > 1);
    if (odds.length === 0) return 0;
    return odds.reduce((acc, n) => acc * n, 1);
  }, [itens]);

  const unidadesNum = useMemo(() => {
    const n = toUnidadesNumber(unidades);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [unidades]);

  const valorApostado = useMemo(() => {
    if (!valorUnidade || valorUnidade <= 0) return 0;
    if (!unidadesNum) return 0;
    return unidadesNum * valorUnidade;
  }, [unidadesNum, valorUnidade]);

  function esporteFinalValue(it: MultiplaItem) {
    return it.esporte === "outros" ? it.esporteCustom.trim() : it.esporte.trim();
  }

  function addItem() {
    setItens((prev) => [
      ...prev,
      { id: crypto.randomUUID(), esporte: "", esporteCustom: "", evento: "", mercado: "", odd: "" },
    ]);
  }

  function removeItem(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(id: string, patch: Partial<MultiplaItem>) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function saveCustomStake() {
    const val = toUnidadesNumber(customUnidade);
    if (!Number.isFinite(val) || val <= 0 || val > 100) {
      setToast({ type: "error", message: "Valor inválido. Use entre 0.1 e 100." });
      return;
    }

    setSavingStake(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setToast({ type: "error", message: "Usuário não autenticado." });
        return;
      }

      // Verifica se já existe
      if (UNIDADES_PREDEFINIDAS.includes(val)) {
        setToast({ type: "error", message: "Esta unidade já existe." });
        return;
      }

      const { error } = await supabase.from("stakes_personalizadas").insert({
        user_id: user.id,
        nome: `${val}Un`,
        percent: val,
      });

      if (error) {
        if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
          setToast({ type: "error", message: "Esta unidade já existe." });
        } else {
          setToast({ type: "error", message: "Erro ao salvar unidade." });
        }
        return;
      }

      // Atualiza lista local
      setCustomStakes((prev) => [...prev, val].sort((a, b) => a - b));
      setUnidades(val.toString());
      setCustomUnidade("");
      setShowCustomUnidade(false);
      setToast({ type: "success", message: `Unidade ${val}Un salva!` });
    } finally {
      setSavingStake(false);
    }
  }

  function validate(): string | null {
    if (itens.length < 2) return "A múltipla precisa ter pelo menos 2 seleções.";
    for (const it of itens) {
      const o = toOddNumber(it.odd);
      if (!Number.isFinite(o) || o <= 1) return "As odds devem ser maiores que 1 em todas as seleções.";
    }
    if (!unidadesNum) return "Informe unidades válidas (ex: 1, 1.5, 2).";
    if (!oddCombinada || oddCombinada <= 1) return "Odd combinada inválida.";
    return null;
  }

  const validationError = useMemo(() => validate(), [itens, unidadesNum, valorUnidade, oddCombinada]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setToast({ type: "error", message: err });
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setToast({ type: "error", message: "Usuário não autenticado." });
        return;
      }

      const valorResultado =
        resultado === "pendente"
          ? null
          : resultado === "green"
          ? valorApostado * oddCombinada - valorApostado
          : -valorApostado;

      // Insere pai
      const { data: parent, error: parentError } = await supabase
        .from("apostas_multiplas")
        .insert({
          user_id: user.id,
          unidades: unidadesNum,
          valor_unidade: valorUnidade,
          valor_apostado: valorApostado,
          odd_combinada: oddCombinada,
          casa: casa.trim() ? casa.trim() : null,
          tipster: tipster.trim() ? tipster.trim() : null,
          resultado,
          valor_resultado: valorResultado,
        })
        .select("id")
        .single();

      if (parentError || !parent?.id) {
        setToast({ type: "error", message: "Erro ao salvar múltipla." });
        return;
      }

      const multiplaId = String(parent.id);

      // Insere itens
      const itemsPayload = itens.map((it) => ({
        user_id: user.id,
        multipla_id: multiplaId,
        esporte: esporteFinalValue(it) || null,
        evento: it.evento.trim() || null,
        mercado: it.mercado.trim() || null,
        odd: toOddNumber(it.odd),
      }));

      const { error: itemsError } = await supabase
        .from("apostas_multiplas_itens")
        .insert(itemsPayload);

      if (itemsError) {
        // best-effort rollback
        await supabase
          .from("apostas_multiplas")
          .delete()
          .eq("id", multiplaId)
          .eq("user_id", user.id);
        setToast({ type: "error", message: "Erro ao salvar seleções da múltipla." });
        return;
      }

      setToast({ type: "success", message: "✅ Múltipla registrada com sucesso!" });
      setTimeout(() => {
        router.push(`/dashboard/minhas-entradas?multipla=${encodeURIComponent(multiplaId)}`);
      }, 700);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? theme === "dark"
                  ? "bg-green-900/20 border-green-800 text-green-200"
                  : "bg-green-50 border-green-200 text-green-800"
                : theme === "dark"
                ? "bg-red-900/20 border-red-800 text-red-200"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/registrar-entradas/tipo")}
          className={`mt-0.5 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold cursor-pointer transition-colors ${
            theme === "dark"
              ? "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
              : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50"
          }`}
          aria-label="Voltar"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          <span>Voltar</span>
        </button>

        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Múltipla</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>
            Registre uma aposta combinada com 2+ seleções.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulário */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-6`}>
            Nova Múltipla
          </h2>

          {loadingUnidade ? (
            <div className={`mb-6 p-4 rounded-lg ${infoBg} border ${cardBorder}`}>
              <div className={`text-xs ${textTertiary} mb-1`}>Unidade</div>
              <div className={`text-sm font-semibold ${textPrimary}`}>Carregando...</div>
            </div>
          ) : (
            <div className={`mb-6 p-4 rounded-lg ${infoBg} border ${cardBorder}`}>
              <div className={`text-xs ${textTertiary} mb-1`}>Valor de 1 unidade</div>
              <div className={`text-sm font-semibold ${textPrimary}`}>
                {valorUnidade > 0
                  ? `R$ ${valorUnidade.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "Não definido (configure em Banca)"}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Itens */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={`text-sm font-semibold ${textPrimary}`}>
                  Seleções
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                    theme === "dark"
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  }`}
                >
                  + Adicionar
                </button>
              </div>

              {itens.map((it, idx) => (
                <div
                  key={it.id}
                  className={`rounded-xl border ${cardBorder} ${infoBg} p-4`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className={`text-xs font-semibold ${textTertiary}`}>
                      Seleção {idx + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      disabled={itens.length <= 2}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        theme === "dark"
                          ? "bg-red-900/20 text-red-200 hover:bg-red-900/30 border border-red-800"
                          : "bg-red-50 text-red-700 hover:bg-red-100"
                      }`}
                    >
                      Remover
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>
                        Esporte <span className={textTertiary}>(opcional)</span>
                      </label>
                      <div className="space-y-2">
                        <select
                          value={it.esporte}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateItem(it.id, {
                              esporte: v,
                              esporteCustom: v === "outros" ? it.esporteCustom : "",
                            });
                          }}
                          className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 appearance-none`}
                        >
                          <option value="">Selecione um esporte</option>
                          {ESPORTES_PREDEFINIDOS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          <option value="outros">Outro</option>
                        </select>

                        {it.esporte === "outros" && (
                          <input
                            value={it.esporteCustom}
                            onChange={(e) => updateItem(it.id, { esporteCustom: e.target.value })}
                            placeholder="Digite o esporte"
                            className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                          />
                        )}
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>
                        Odd
                      </label>
                      <input
                        value={it.odd}
                        onChange={(e) => updateItem(it.id, { odd: e.target.value.replace(/[^\d,.-]/g, "") })}
                        placeholder="Ex: 1.80"
                        inputMode="decimal"
                        className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>
                        Evento / Seleção <span className={textTertiary}>(opcional)</span>
                      </label>
                      <input
                        value={it.evento}
                        onChange={(e) => updateItem(it.id, { evento: e.target.value })}
                        placeholder="Ex: Time A vs Time B — Vitória Time A"
                        className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>
                        Mercado <span className={textTertiary}>(opcional)</span>
                      </label>
                      <input
                        value={it.mercado}
                        onChange={(e) => updateItem(it.id, { mercado: e.target.value })}
                        placeholder="Ex: Handicap, Over 2.5, Cantos..."
                        className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo */}
            <div className={`rounded-xl border ${cardBorder} ${infoBg} p-4`}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className={`text-xs ${textTertiary}`}>Odd combinada</div>
                  <div className={`text-lg font-semibold ${textPrimary}`}>
                    {oddCombinada > 0 ? oddCombinada.toFixed(2) : "—"}
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${textTertiary}`}>Unidades</div>
                  <div className={`text-lg font-semibold ${textPrimary}`}>
                    {unidadesNum ? unidadesNum.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—"}
                  </div>
                </div>
                <div>
                  <div className={`text-xs ${textTertiary}`}>Valor (R$)</div>
                  <div className={`text-lg font-semibold ${textPrimary}`}>
                    {valorApostado > 0
                      ? valorApostado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Unidades */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Unidades
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {UNIDADES_PREDEFINIDAS.map((un) => (
                  <button
                    key={un}
                    type="button"
                    onClick={() => {
                      setUnidades(un.toString());
                      setShowCustomUnidade(false);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                      unidades === un.toString() && !showCustomUnidade
                        ? theme === "dark"
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-600 text-white"
                        : theme === "dark"
                          ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
                          : "bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-300"
                    }`}
                  >
                    {un}Un
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowCustomUnidade(!showCustomUnidade)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                    showCustomUnidade
                      ? theme === "dark"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-600 text-white"
                      : theme === "dark"
                        ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
                        : "bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-300"
                  }`}
                >
                  + Outro
                </button>
              </div>
              {showCustomUnidade && (
                <div className="flex gap-2">
                  <input
                    value={customUnidade}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d,.-]/g, "");
                      setCustomUnidade(val);
                      setUnidades(val);
                    }}
                    inputMode="decimal"
                    placeholder="Digite o valor (ex: 1.5)"
                    className={`flex-1 p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveCustomStake}
                    disabled={savingStake || !customUnidade.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      theme === "dark"
                        ? "bg-emerald-600 text-white hover:bg-emerald-500"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {savingStake ? "..." : "Salvar"}
                  </button>
                </div>
              )}
            </div>

            {/* Campos adicionais */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Casa <span className={textTertiary}>(opcional)</span>
                </label>
                <input
                  value={casa}
                  onChange={(e) => setCasa(e.target.value)}
                  placeholder="Ex: Bet365"
                  className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Tipster <span className={textTertiary}>(opcional)</span>
                </label>
                <input
                  value={tipster}
                  onChange={(e) => setTipster(e.target.value)}
                  placeholder="Ex: Nome do tipster"
                  className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                />
              </div>
            </div>

            {/* Resultado */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-3`}>Resultado</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { v: "pendente" as const, label: "Pendente", cls: "bg-zinc-600 border-zinc-600 hover:bg-zinc-700" },
                  { v: "green" as const, label: "Green", cls: "bg-green-600 border-green-600 hover:bg-green-700" },
                  { v: "red" as const, label: "Red", cls: "bg-red-600 border-red-600 hover:bg-red-700" },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors ${
                      resultado === opt.v
                        ? opt.cls
                        : theme === "dark"
                        ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                        : "bg-white border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resultado"
                      value={opt.v}
                      checked={resultado === opt.v}
                      onChange={() => setResultado(opt.v)}
                      className="mr-2"
                    />
                    <span className={`font-semibold ${resultado === opt.v ? "text-white" : textPrimary}`}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!validationError}
              className={`w-full h-12 px-4 rounded-lg font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                theme === "dark"
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {loading ? "Salvando..." : "Registrar Múltipla"}
            </button>
          </form>
        </div>

        {/* Preview / Ajuda (dark) */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Resumo</h2>
          <div className={`space-y-3 text-sm ${textSecondary}`}>
            <div className="flex items-center justify-between">
              <span>Seleções</span>
              <span className={`font-semibold ${textPrimary}`}>{itens.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Odd combinada</span>
              <span className={`font-semibold ${textPrimary}`}>{oddCombinada > 0 ? oddCombinada.toFixed(2) : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unidades</span>
              <span className={`font-semibold ${textPrimary}`}>{unidadesNum || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Valor (R$)</span>
              <span className={`font-semibold ${textPrimary}`}>
                {valorApostado > 0
                  ? valorApostado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "—"}
              </span>
            </div>
            <div className={`mt-4 text-xs ${textTertiary}`}>
              Apenas odds &gt; 1 são obrigatórias. Mínimo 2 seleções.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

