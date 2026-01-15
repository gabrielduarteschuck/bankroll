"use client";

import { useState, useEffect } from "react";
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
  resultado: "green" | "red" | "pendente";
  valor_resultado: number | null;
  created_at: string;
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
  const { theme } = useTheme();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [entradasFiltradas, setEntradasFiltradas] = useState<Entrada[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos");
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

  // Estados para edição
  const [editStake, setEditStake] = useState<string>("");
  const [editOdd, setEditOdd] = useState<string>("");
  const [editEsporte, setEditEsporte] = useState<string>("");
  const [editEsporteCustomizado, setEditEsporteCustomizado] = useState<string>("");
  const [editMercadoTexto, setEditMercadoTexto] = useState<string>("");
  const [editResultado, setEditResultado] = useState<"green" | "red" | "pendente">("pendente");
  const [editValorResultado, setEditValorResultado] = useState<string>("");

  useEffect(() => {
    loadEntradas();
  }, []);

  useEffect(() => {
    filtrarEntradas();
  }, [entradas, filtroPeriodo, dataInicio, dataFim]);

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
      setEntradasFiltradas(entradas);
      setPaginaAtual(1);
      return;
    }

    const dateRange = getDateRange();
    if (!dateRange) {
      setEntradasFiltradas(entradas);
      setPaginaAtual(1);
      return;
    }

    const filtradas = entradas.filter((entrada) => {
      const dataEntrada = new Date(entrada.created_at);
      return dataEntrada >= new Date(dateRange.inicio) && dataEntrada <= new Date(dateRange.fim);
    });

    setEntradasFiltradas(filtradas);
    setPaginaAtual(1);
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
    } catch (error) {
      console.error("Erro ao carregar entradas:", error);
    } finally {
      setLoading(false);
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
      const valorResultadoFinal = editValorResultado
        ? parseFloat(editValorResultado.replace(",", "."))
        : null;

      if (isNaN(stakeValue) || stakeValue <= 0) {
        alert("Stake inválida");
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

  const totalEntradas = entradasFiltradas.length;
  const totalGreens = entradasFiltradas.filter((e) => e.resultado === "green").length;
  const totalReds = entradasFiltradas.filter((e) => e.resultado === "red").length;
  const somaResultados = entradasFiltradas.reduce((acc, e) => {
    return acc + (e.valor_resultado || 0);
  }, 0);

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
        </div>
      </div>

      {/* Lista de Entradas */}
      {entradas.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${cardBorder} ${cardBg} p-12 text-center`}>
          <div className={textTertiary + " mb-2"}>Nenhuma entrada registrada ainda</div>
          <div className={`text-sm ${textTertiary}`}>
            Vá em "Registrar Entradas" para começar
          </div>
        </div>
      ) : entradasFiltradas.length === 0 ? (
        <div className={`rounded-2xl border border-dashed ${cardBorder} ${cardBg} p-12 text-center`}>
          <div className={textTertiary + " mb-2"}>Nenhuma entrada encontrada no período selecionado</div>
          <div className={`text-sm ${textTertiary}`}>
            Tente selecionar outro período ou "Todos"
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
                        Stake (%)
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
                    </div>
                    <div className="flex gap-2">
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
                      <div className={`text-xs ${textTertiary} mb-1`}>Stake</div>
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        {entrada.stake_percent}%
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
