"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

// 10 esportes mais comuns (ordem de uso), + opção "Outro"
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

type Entrada = {
  id: string;
  stake_percent: number;
  valor_stake: number;
  odd: number;
  esporte: string | null;
  mercado: string | null;
  observacoes?: string | null;
  favorita?: boolean | null;
  resultado: "green" | "red" | "pendente";
  valor_resultado: number | null;
  created_at: string;
};

type Multipla = {
  id: string;
  unidades: number;
  valor_unidade: number;
  valor_apostado: number;
  odd_combinada: number;
  casa: string | null;
  tipster: string | null;
  data_aposta: string | null;
  resultado: "green" | "red" | "pendente";
  valor_resultado: number | null;
  created_at: string;
};

type MultiplaItem = {
  id: string;
  multipla_id: string;
  esporte: string;
  evento: string;
  mercado: string | null;
  odd: number;
};

type FiltroPeriodo = 
  | "hoje"
  | "ontem"
  | "7dias"
  | "15dias"
  | "30dias"
  | "60dias"
  | "90dias"
  | "personalizado"
  | "todos";

export default function MinhasEntradasPage() {
  const searchParams = useSearchParams();
  const highlightMultiplaId = searchParams.get("multipla");
  const { theme } = useTheme();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [entradasFiltradas, setEntradasFiltradas] = useState<Entrada[]>([]);
  const [multiplas, setMultiplas] = useState<Multipla[]>([]);
  const [multiplasItens, setMultiplasItens] = useState<Record<string, MultiplaItem[]>>({});
  const [editingMultiplaId, setEditingMultiplaId] = useState<string | null>(null);
  const [editMultiplaResultado, setEditMultiplaResultado] = useState<"pendente" | "green" | "red">("pendente");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos");
  const [apenasFavoritas, setApenasFavoritas] = useState(false);
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";
  const infoBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-50";

  // Estados para edição
  const [editStake, setEditStake] = useState<string>("");
  const [editOdd, setEditOdd] = useState<string>("");
  const [editEsporte, setEditEsporte] = useState<string>("");
  const [editEsporteCustomizado, setEditEsporteCustomizado] = useState<string>("");
  const [editMercadoTexto, setEditMercadoTexto] = useState<string>("");
  const [editObservacoes, setEditObservacoes] = useState<string>("");
  const [editResultado, setEditResultado] = useState<"green" | "red" | "pendente">("pendente");
  const [editValorResultado, setEditValorResultado] = useState<string>("");

  useEffect(() => {
    loadEntradas();
  }, []);

  useEffect(() => {
    filtrarEntradas();
  }, [entradas, filtroPeriodo, apenasFavoritas, dataInicio, dataFim]);

  function getDateRange() {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    let inicio: Date;
    let fim: Date = hoje;

    switch (filtroPeriodo) {
      case "hoje":
        inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        break;
      case "ontem":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 1);
        inicio.setHours(0, 0, 0, 0);
        fim = new Date(inicio);
        fim.setHours(23, 59, 59, 999);
        break;
      case "7dias":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 7);
        inicio.setHours(0, 0, 0, 0);
        break;
      case "15dias":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 15);
        inicio.setHours(0, 0, 0, 0);
        break;
      case "30dias":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 30);
        inicio.setHours(0, 0, 0, 0);
        break;
      case "60dias":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 60);
        inicio.setHours(0, 0, 0, 0);
        break;
      case "90dias":
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 90);
        inicio.setHours(0, 0, 0, 0);
        break;
      case "personalizado":
        if (dataInicio && dataFim) {
          inicio = new Date(dataInicio);
          inicio.setHours(0, 0, 0, 0);
          fim = new Date(dataFim);
          fim.setHours(23, 59, 59, 999);
        } else {
          return null;
        }
        break;
      case "todos":
      default:
        return null;
    }

    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }

  function filtrarEntradas() {
    if (filtroPeriodo === "todos") {
      const base = apenasFavoritas
        ? entradas.filter((e) => e.favorita === true)
        : entradas;
      setEntradasFiltradas(base);
      setPaginaAtual(1);
      return;
    }

    const dateRange = getDateRange();
    if (!dateRange) {
      setEntradasFiltradas(entradas);
      setPaginaAtual(1);
      return;
    }

    let filtradas = entradas.filter((entrada) => {
      const dataEntrada = new Date(entrada.created_at);
      return dataEntrada >= new Date(dateRange.inicio) && dataEntrada <= new Date(dateRange.fim);
    });

    if (apenasFavoritas) {
      filtradas = filtradas.filter((e) => e.favorita === true);
    }

    setEntradasFiltradas(filtradas);
    setPaginaAtual(1);
  }

  // Filtra múltiplas usando useMemo para garantir reatividade
  const multiplasFiltradas = useMemo(() => {
    if (filtroPeriodo === "todos") {
      return multiplas;
    }

    const dateRange = getDateRange();
    if (!dateRange) {
      return multiplas;
    }

    return multiplas.filter((m) => {
      const dataMultipla = new Date(m.created_at);
      return dataMultipla >= new Date(dateRange.inicio) && dataMultipla <= new Date(dateRange.fim);
    });
  }, [multiplas, filtroPeriodo, dataInicio, dataFim]);

  async function toggleFavorita(entrada: Entrada) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const newValue = !(entrada.favorita === true);
      const { error } = await supabase
        .from("entradas")
        .update({ favorita: newValue, updated_at: new Date().toISOString() })
        .eq("id", entrada.id)
        .eq("user_id", user.id);

      if (error) {
        alert("Erro ao atualizar favorito");
        return;
      }

      setEntradas((prev) =>
        prev.map((e) => (e.id === entrada.id ? { ...e, favorita: newValue } : e))
      );
    } catch {
      alert("Erro ao atualizar favorito");
    }
  }

  const ITENS_POR_PAGINA = 20;
  const totalPaginas = Math.max(1, Math.ceil(entradasFiltradas.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(Math.max(1, paginaAtual), totalPaginas);
  const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;
  const entradasPaginadas = entradasFiltradas.slice(inicio, fim);

  async function loadEntradas() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("entradas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar entradas:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setEntradas(data as Entrada[]);
      }

      // Carrega múltiplas (best-effort)
      try {
        const { data: mData, error: mErr } = await supabase
          .from("apostas_multiplas")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!mErr && mData) {
          const mList = mData as any as Multipla[];
          setMultiplas(mList);

          const ids = mList.map((m) => m.id);
          if (ids.length > 0) {
            const { data: iData, error: iErr } = await supabase
              .from("apostas_multiplas_itens")
              .select("*")
              .eq("user_id", user.id)
              .in("multipla_id", ids);

            if (!iErr && iData) {
              const grouped: Record<string, MultiplaItem[]> = {};
              for (const it of iData as any as MultiplaItem[]) {
                const key = String(it.multipla_id);
                grouped[key] = grouped[key] || [];
                grouped[key].push(it);
              }
              setMultiplasItens(grouped);
            } else {
              setMultiplasItens({});
            }
          } else {
            setMultiplasItens({});
          }
        } else {
          setMultiplas([]);
          setMultiplasItens({});
        }
      } catch {
        setMultiplas([]);
        setMultiplasItens({});
      }
    } catch (error) {
      console.error("Erro ao carregar entradas:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatDateOnly(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  async function saveMultiplaResultado(m: Multipla) {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Usuário não autenticado");
        return;
      }

      const newRes = editMultiplaResultado;
      const valorResultado =
        newRes === "pendente"
          ? null
          : newRes === "green"
          ? (Number(m.valor_apostado) || 0) * (Number(m.odd_combinada) || 0) - (Number(m.valor_apostado) || 0)
          : -(Number(m.valor_apostado) || 0);

      const { error } = await supabase
        .from("apostas_multiplas")
        .update({ resultado: newRes, valor_resultado: valorResultado, updated_at: new Date().toISOString() })
        .eq("id", m.id)
        .eq("user_id", user.id);

      if (error) {
        alert("Erro ao atualizar resultado da múltipla");
        return;
      }

      setMultiplas((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, resultado: newRes, valor_resultado: valorResultado } : x))
      );
      setEditingMultiplaId(null);
      alert("Múltipla atualizada com sucesso!");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entrada: Entrada) {
    setEditingId(entrada.id);
    setEditStake(entrada.stake_percent.toString());
    setEditOdd(entrada.odd.toString());
    const esporteValue = entrada.esporte || "Basquete (NBA)";
    setEditEsporte(ESPORTES_PREDEFINIDOS.includes(esporteValue as any) ? esporteValue : "outros");
    setEditEsporteCustomizado(ESPORTES_PREDEFINIDOS.includes(esporteValue as any) ? "" : esporteValue);
    setEditMercadoTexto(entrada.mercado || "");
    setEditObservacoes(entrada.observacoes || "");
    setEditResultado(entrada.resultado);
    setEditValorResultado(entrada.valor_resultado?.toString() || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditStake("");
    setEditOdd("");
    setEditEsporte("");
    setEditEsporteCustomizado("");
    setEditMercadoTexto("");
    setEditObservacoes("");
    setEditResultado("pendente");
    setEditValorResultado("");
  }

  async function saveEdit(entrada: Entrada) {
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Usuário não autenticado");
        setSaving(false);
        return;
      }

      const stakeValue = parseFloat(editStake.replace(",", "."));
      const oddValue = parseFloat(editOdd.replace(",", "."));
      const esporteFinal =
        editEsporte === "outros" ? editEsporteCustomizado.trim() : editEsporte.trim();
      const mercadoFinal = editMercadoTexto.trim() ? editMercadoTexto.trim() : null;
      const observacoesFinal = editObservacoes.trim() ? editObservacoes.trim() : null;
      const valorResultadoFinal = editValorResultado
        ? parseFloat(editValorResultado.replace(",", "."))
        : null;

      if (isNaN(stakeValue) || stakeValue <= 0) {
        alert("Unidade inválida");
        setSaving(false);
        return;
      }

      if (isNaN(oddValue) || oddValue <= 0) {
        alert("Odd inválida");
        setSaving(false);
        return;
      }

      if (!esporteFinal) {
        alert("Esporte inválido");
        setSaving(false);
        return;
      }

      // Recalcula valor apostado e resultado se necessário
      const { data: bancaData } = await supabase
        .from("banca")
        .select("valor")
        .eq("user_id", user.id)
        .single();

      const banca = bancaData?.valor || 0;
      const novoValorApostado = (banca * stakeValue) / 100;

      let novoValorResultado = valorResultadoFinal;
      if (editResultado === "green" && novoValorResultado === null) {
        novoValorResultado = novoValorApostado * oddValue - novoValorApostado;
      } else if (editResultado === "red" && novoValorResultado === null) {
        novoValorResultado = -novoValorApostado;
      }

      const { error } = await supabase
        .from("entradas")
        .update({
          stake_percent: stakeValue,
          valor_stake: novoValorApostado,
          odd: oddValue,
          esporte: esporteFinal,
          mercado: mercadoFinal,
          observacoes: observacoesFinal,
          resultado: editResultado,
          valor_resultado: novoValorResultado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entrada.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar alterações");
        setSaving(false);
        return;
      }

      alert("Entrada atualizada com sucesso!");
      cancelEdit();
      loadEntradas();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar alterações");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntrada(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta entrada?")) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from("entradas")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir entrada");
        return;
      }

      alert("Entrada excluída com sucesso!");
      loadEntradas();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      alert("Erro ao excluir entrada");
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getResultadoColor(resultado: string): string {
    if (resultado === "green") {
      return theme === "dark"
        ? "text-green-400 bg-green-900/20 border-green-800"
        : "text-green-600 bg-green-50 border-green-200";
    }
    if (resultado === "red") {
      return theme === "dark"
        ? "text-red-400 bg-red-900/20 border-red-800"
        : "text-red-600 bg-red-50 border-red-200";
    }
    return theme === "dark"
      ? "text-zinc-400 bg-zinc-800 border-zinc-700"
      : "text-zinc-600 bg-zinc-50 border-zinc-200";
  }

  function getResultadoLabel(resultado: string): string {
    if (resultado === "green") return "Green";
    if (resultado === "red") return "Red";
    return "Pendente";
  }

  // Totais combinados: entradas simples + múltiplas (filtradas)
  const totalEntradasSimples = entradasFiltradas.length;
  const totalMultiplas = multiplasFiltradas.length;
  const totalEntradas = totalEntradasSimples + totalMultiplas;

  const greensEntradas = entradasFiltradas.filter((e) => e.resultado === "green").length;
  const greensMultiplas = multiplasFiltradas.filter((m) => m.resultado === "green").length;
  const totalGreens = greensEntradas + greensMultiplas;

  const redsEntradas = entradasFiltradas.filter((e) => e.resultado === "red").length;
  const redsMultiplas = multiplasFiltradas.filter((m) => m.resultado === "red").length;
  const totalReds = redsEntradas + redsMultiplas;

  const somaResultadosEntradas = entradasFiltradas.reduce((acc, e) => {
    return acc + (e.valor_resultado || 0);
  }, 0);
  const somaResultadosMultiplas = multiplasFiltradas.reduce((acc, m) => {
    return acc + (m.valor_resultado || 0);
  }, 0);
  const somaResultados = somaResultadosEntradas + somaResultadosMultiplas;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Minhas Entradas</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Minhas Entradas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Histórico completo de todas as suas entradas registradas
        </p>
      </div>

      {/* Resumo */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-4 shadow-sm`}>
            <div className={`text-sm font-medium ${textSecondary}`}>Total de Entradas</div>
            <div className={`mt-2 text-2xl font-semibold ${textPrimary}`}>{totalEntradas}</div>
          </div>
          <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-4 shadow-sm`}>
            <div className={`text-sm font-medium ${textSecondary}`}>Resultado Total</div>
            <div
              className={`mt-2 text-2xl font-semibold ${
                somaResultados >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {somaResultados >= 0 ? "+" : ""}
              R$ {somaResultados.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-4 shadow-sm`}>
            <div className={`text-sm font-medium ${textSecondary}`}>Greens</div>
            <div className="mt-2 text-2xl font-semibold text-green-500">{totalGreens}</div>
          </div>
          <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-4 shadow-sm`}>
            <div className={`text-sm font-medium ${textSecondary}`}>Reds</div>
            <div className="mt-2 text-2xl font-semibold text-red-500">{totalReds}</div>
          </div>
        </div>
      </div>

      {/* Filtro (compacto) */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-medium ${textSecondary}`}>Período</span>
          <select
            value={filtroPeriodo}
            onChange={(e) => {
              const value = e.target.value as FiltroPeriodo;
              setFiltroPeriodo(value);
              if (value !== "personalizado") {
                setDataInicio("");
                setDataFim("");
              }
            }}
            className={`px-3 py-2 rounded-lg border ${inputBorder} ${inputBg} ${inputText} text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500`}
          >
            <option value="todos">Todos</option>
            <option value="hoje">Hoje</option>
            <option value="ontem">Ontem</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="15dias">Últimos 15 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="60dias">Últimos 60 dias</option>
            <option value="90dias">Últimos 90 dias</option>
            <option value="personalizado">Personalizado</option>
          </select>

          {filtroPeriodo === "personalizado" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${inputBorder} ${inputBg} ${inputText} text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500`}
              />
              <span className={textTertiary}>até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={`px-3 py-2 rounded-lg border ${inputBorder} ${inputBg} ${inputText} text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500`}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setApenasFavoritas((v) => !v)}
            className={`ml-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer border ${
              apenasFavoritas
                ? theme === "dark"
                  ? "bg-amber-900/20 border-amber-800 text-amber-200"
                  : "bg-amber-50 border-amber-300 text-amber-900"
                : theme === "dark"
                ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
                : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200"
            }`}
            aria-pressed={apenasFavoritas}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 ${apenasFavoritas ? "text-amber-500" : ""}`}
              fill={apenasFavoritas ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
            Apenas favoritas
          </button>
        </div>
      </div>

      {/* Múltiplas */}
      {(multiplasFiltradas.length > 0 || highlightMultiplaId) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Múltiplas</h2>
            {highlightMultiplaId ? (
              <a
                href="/dashboard/minhas-entradas"
                className={`text-xs font-semibold underline underline-offset-4 ${textSecondary}`}
              >
                Ver todas
              </a>
            ) : null}
          </div>

          {(highlightMultiplaId
            ? multiplas.filter((m) => m.id === highlightMultiplaId)
            : multiplasFiltradas
          )
            .slice(0, highlightMultiplaId ? 1 : 10)
            .map((m) => {
              const items = multiplasItens[m.id] || [];
              const highlighted = highlightMultiplaId === m.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm ${
                    highlighted ? (theme === "dark" ? "ring-2 ring-green-500/40" : "ring-2 ring-green-500/30") : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>
                        {formatDate(m.created_at)}
                        {m.data_aposta ? ` • Data: ${formatDateOnly(m.data_aposta)}` : ""}
                      </div>
                      <div className={`text-sm font-semibold ${textPrimary}`}>
                        Múltipla • {items.length} seleções • Odd {Number(m.odd_combinada || 0).toFixed(2)}
                      </div>
                      <div className={`text-xs ${textSecondary} mt-1`}>
                        Unidades: {Number(m.unidades || 0).toLocaleString("pt-BR")} • Valor: R${" "}
                        {Number(m.valor_apostado || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        {m.casa ? ` • Casa: ${m.casa}` : ""}
                        {m.tipster ? ` • Tipster: ${m.tipster}` : ""}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMultiplaId(m.id);
                          setEditMultiplaResultado(m.resultado);
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          theme === "dark"
                            ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Resultado
                      </button>
                    </div>
                  </div>

                  {editingMultiplaId === m.id ? (
                    <div className={`rounded-xl border ${cardBorder} ${infoBg} p-4`}>
                      <div className={`text-xs font-semibold ${textSecondary} mb-2`}>Atualizar resultado</div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["pendente", "green", "red"] as const).map((r) => (
                          <label
                            key={r}
                            className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors ${
                              editMultiplaResultado === r
                                ? r === "green"
                                  ? "bg-green-600 border-green-600 hover:bg-green-700 text-white"
                                  : r === "red"
                                  ? "bg-red-600 border-red-600 hover:bg-red-700 text-white"
                                  : "bg-zinc-600 border-zinc-600 hover:bg-zinc-700 text-white"
                                : theme === "dark"
                                ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                                : "bg-white border-zinc-300 hover:bg-zinc-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`multipla-${m.id}-resultado`}
                              value={r}
                              checked={editMultiplaResultado === r}
                              onChange={(e) => setEditMultiplaResultado(e.target.value as any)}
                              className="mr-2"
                            />
                            <span className={`text-sm font-semibold ${
                              editMultiplaResultado === r ? "text-white" : textPrimary
                            }`}>
                              {r === "pendente" ? "Pendente" : r === "green" ? "Green" : "Red"}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveMultiplaResultado(m)}
                          disabled={saving}
                          className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 ${
                            theme === "dark" ? "bg-zinc-700 hover:bg-zinc-600" : "bg-zinc-900 hover:bg-zinc-800"
                          }`}
                        >
                          {saving ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingMultiplaId(null)}
                          disabled={saving}
                          className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${
                            theme === "dark"
                              ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          }`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${textTertiary}`}>Resultado</div>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getResultadoColor(
                            m.resultado
                          )}`}
                        >
                          {getResultadoLabel(m.resultado)}
                        </span>
                      </div>

                      {typeof m.valor_resultado === "number" ? (
                        <div className="flex items-center justify-between">
                          <div className={`text-xs ${textTertiary}`}>Valor Resultado</div>
                          <div
                            className={`text-sm font-semibold ${
                              (m.valor_resultado || 0) >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {(m.valor_resultado || 0) >= 0 ? "+" : ""}R${" "}
                            {(m.valor_resultado || 0).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      ) : null}

                      {items.length > 0 ? (
                        <div className={`mt-3 rounded-xl border ${cardBorder} ${infoBg} p-4`}>
                          <div className={`text-xs font-semibold ${textSecondary} mb-2`}>Seleções</div>
                          <div className="space-y-2">
                            {items.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className={`text-sm font-medium ${textPrimary} truncate`}>
                                    {it.evento}
                                  </div>
                                  <div className={`text-xs ${textSecondary}`}>
                                    {it.esporte}
                                    {it.mercado ? ` • ${it.mercado}` : ""}
                                  </div>
                                </div>
                                <div className={`text-sm font-semibold ${textPrimary}`}>
                                  {Number(it.odd || 0).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Lista de Entradas */}
      {entradas.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${cardBorder} ${cardBg} p-12 text-center`}>
          <div className={textTertiary + " mb-2"}>Nenhuma entrada registrada ainda</div>
          <div className={`text-sm ${textTertiary}`}>
            Vá em &quot;Registrar Entradas&quot; para começar
          </div>
        </div>
      ) : entradasFiltradas.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${cardBorder} ${cardBg} p-12 text-center`}>
          <div className={textTertiary + " mb-2"}>Nenhuma entrada encontrada no período selecionado</div>
          <div className={`text-sm ${textTertiary}`}>
            Tente selecionar outro período ou &quot;Todos&quot;
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {entradasPaginadas.map((entrada) => (
            <div
              key={entrada.id}
              className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}
            >
              {editingId === entrada.id ? (
                // Modo Edição
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Unidade (un)
                      </label>
                      <input
                        type="text"
                        value={editStake}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d,.-]/g, "");
                          setEditStake(value);
                        }}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Odd
                      </label>
                      <input
                        type="text"
                        value={editOdd}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d,.-]/g, "");
                          setEditOdd(value);
                        }}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Esporte
                      </label>
                      <select
                        value={editEsporte}
                        onChange={(e) => {
                          setEditEsporte(e.target.value);
                          if (e.target.value !== "outros") {
                            setEditEsporteCustomizado("");
                          }
                        }}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      >
                        {ESPORTES_PREDEFINIDOS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value="outros">Outro</option>
                      </select>
                      {editEsporte === "outros" && (
                        <input
                          type="text"
                          placeholder="Digite o esporte"
                          value={editEsporteCustomizado}
                          onChange={(e) => setEditEsporteCustomizado(e.target.value)}
                          className={`w-full mt-2 p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                        />
                      )}
                    </div>

                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Mercado (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Ambas marcam, Over 2.5, Handicap..."
                        value={editMercadoTexto}
                        onChange={(e) => setEditMercadoTexto(e.target.value)}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Descrição (opcional)
                      </label>
                      <textarea
                        placeholder="Ex: Motivo da entrada, leitura do jogo, plano de gestão..."
                        value={editObservacoes}
                        onChange={(e) => setEditObservacoes(e.target.value)}
                        rows={3}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Resultado
                      </label>
                      <select
                        value={editResultado}
                        onChange={(e) =>
                          setEditResultado(e.target.value as "green" | "red" | "pendente")
                        }
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="green">Green</option>
                        <option value="red">Red</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium ${textSecondary} mb-1`}>
                        Valor Resultado (R$)
                      </label>
                      <input
                        type="text"
                        placeholder="Deixe em branco para calcular automaticamente"
                        value={editValorResultado}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d,.-]/g, "");
                          setEditValorResultado(value);
                        }}
                        className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(entrada)}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 ${
                        theme === "dark" 
                          ? "bg-zinc-700 hover:bg-zinc-600" 
                          : "bg-zinc-900 hover:bg-zinc-800"
                      }`}
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${
                        theme === "dark"
                          ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                // Modo Visualização
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>
                        {formatDate(entrada.created_at)}
                      </div>
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        Esporte: {entrada.esporte || "—"}
                      </div>
                      {entrada.mercado ? (
                        <div className={`text-xs ${textSecondary} mt-1`}>
                          Mercado: {entrada.mercado}
                        </div>
                      ) : null}
                      {entrada.observacoes ? (
                        <div className={`text-xs ${textSecondary} mt-1`}>
                          Descrição: {entrada.observacoes}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFavorita(entrada)}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors border ${
                          entrada.favorita
                            ? theme === "dark"
                              ? "bg-amber-900/20 text-amber-200 hover:bg-amber-900/30 border-amber-800"
                              : "bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300"
                            : theme === "dark"
                            ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-zinc-700"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border-zinc-200"
                        }`}
                        aria-label={entrada.favorita ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill={entrada.favorita ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => startEdit(entrada)}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          theme === "dark"
                            ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        }`}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteEntrada(entrada.id)}
                        className={`px-3 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                          theme === "dark"
                            ? "bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-800"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>Unidade</div>
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        {entrada.stake_percent} un
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>Valor Apostado</div>
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        R$ {entrada.valor_stake.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>Odd</div>
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        {entrada.odd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>Resultado</div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getResultadoColor(
                          entrada.resultado
                        )}`}
                      >
                        {getResultadoLabel(entrada.resultado)}
                      </span>
                    </div>
                    <div>
                      <div className={`text-xs ${textTertiary} mb-1`}>Valor Resultado</div>
                      <div
                        className={`text-sm font-semibold ${
                          (entrada.valor_resultado || 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {(entrada.valor_resultado || 0) >= 0 ? "+" : ""}
                        R$ {(entrada.valor_resultado || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Paginação (20 por página) */}
          {totalPaginas > 1 && (
            <div className={`mt-6 rounded-xl border ${cardBorder} ${cardBg} p-4`}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                  disabled={paginaSegura === 1}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    paginaSegura === 1
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${
                    theme === "dark"
                      ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  ←
                </button>

                {Array.from({ length: totalPaginas }).map((_, idx) => {
                  const page = idx + 1;
                  const label = page.toString().padStart(2, "0");
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setPaginaAtual(page)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                        page === paginaSegura
                          ? theme === "dark"
                            ? "bg-zinc-700 text-white"
                            : "bg-zinc-900 text-white"
                          : theme === "dark"
                          ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura === totalPaginas}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    paginaSegura === totalPaginas
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  } ${
                    theme === "dark"
                      ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  →
                </button>
              </div>
              <div className={`mt-2 text-center text-xs ${textTertiary}`}>
                Mostrando {inicio + 1}–{Math.min(fim, entradasFiltradas.length)} de {entradasFiltradas.length}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
