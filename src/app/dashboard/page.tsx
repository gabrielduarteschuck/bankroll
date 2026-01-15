"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type FiltroPeriodo = 
  | "hoje"
  | "ontem"
  | "7dias"
  | "15dias"
  | "30dias"
  | "60dias"
  | "90dias"
  | "personalizado";

export default function DashboardHome() {
  const [totalEntradas, setTotalEntradas] = useState(0);
  const [greens, setGreens] = useState(0);
  const [reds, setReds] = useState(0);
  const [bancaInicial, setBancaInicial] = useState(0);
  const [bancaAtual, setBancaAtual] = useState(0);
  const [lucroBanca, setLucroBanca] = useState(0);
  const [roi, setRoi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("30dias");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [sequenciasGreens, setSequenciasGreens] = useState<number[]>([]);
  const { theme } = useTheme();

  useEffect(() => {
    loadData();
  }, [filtroPeriodo, dataInicio, dataFim]);

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
          // Se não tiver datas personalizadas, usa 30 dias
          inicio = new Date(hoje);
          inicio.setDate(inicio.getDate() - 30);
          inicio.setHours(0, 0, 0, 0);
        }
        break;
      default:
        inicio = new Date(hoje);
        inicio.setDate(inicio.getDate() - 30);
        inicio.setHours(0, 0, 0, 0);
    }

    return { inicio: inicio.toISOString(), fim: fim.toISOString() };
  }

  function calcularSequenciasGreens(entradas: any[]) {
    const sequencias: number[] = [];
    let sequenciaAtual = 0;

    // Ordena por data (mais antiga primeiro) para calcular sequências
    const entradasOrdenadas = [...entradas].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const entrada of entradasOrdenadas) {
      if (entrada.resultado === "green") {
        sequenciaAtual++;
      } else if (entrada.resultado === "red") {
        if (sequenciaAtual > 0) {
          sequencias.push(sequenciaAtual);
          sequenciaAtual = 0;
        }
      }
    }

    // Adiciona a última sequência se terminar em green
    if (sequenciaAtual > 0) {
      sequencias.push(sequenciaAtual);
    }

    return sequencias.sort((a, b) => b - a); // Ordena do maior para o menor
  }

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Busca banca
      const { data: bancaData } = await supabase
        .from("banca")
        .select("valor")
        .eq("user_id", user.id)
        .single();

      if (bancaData) {
        setBancaInicial(bancaData.valor);
        setBancaAtual(bancaData.valor);
      }

      // Calcula range de datas
      const { inicio, fim } = getDateRange();

      // Busca entradas com filtro de data
      let query = supabase
        .from("entradas")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", inicio)
        .lte("created_at", fim)
        .order("created_at", { ascending: false });

      const { data: entradasData, error } = await query;

      if (error) {
        console.error("Erro ao carregar entradas:", error);
        setLoading(false);
        return;
      }

      if (entradasData) {
        setTotalEntradas(entradasData.length);

        const greensCount = entradasData.filter(
          (e) => e.resultado === "green"
        ).length;
        const redsCount = entradasData.filter(
          (e) => e.resultado === "red"
        ).length;

        setGreens(greensCount);
        setReds(redsCount);

        // Calcula sequências de greens
        const sequencias = calcularSequenciasGreens(entradasData);
        setSequenciasGreens(sequencias);

        // Calcula banca atual (banca inicial + soma dos resultados)
        const somaResultados = entradasData.reduce((acc, entrada) => {
          if (entrada.valor_resultado) {
            return acc + parseFloat(entrada.valor_resultado);
          }
          return acc;
        }, 0);

        if (bancaData) {
          const novaBanca = parseFloat(bancaData.valor) + somaResultados;
          setBancaAtual(novaBanca);
        }

        // Calcula lucro sobre a banca
        if (bancaData && bancaData.valor > 0) {
          const lucro = ((somaResultados / bancaData.valor) * 100);
          setLucroBanca(lucro);
        }

        // Calcula ROI (soma dos lucros / soma dos valores apostados * 100)
        const totalApostado = entradasData.reduce((acc, entrada) => {
          return acc + parseFloat(entrada.valor_stake || 0);
        }, 0);

        if (totalApostado > 0) {
          const roiCalculado = (somaResultados / totalApostado) * 100;
          setRoi(roiCalculado);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className={`h-8 w-48 rounded-lg animate-pulse mb-2 ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"
          }`}></div>
          <div className={`h-4 w-64 rounded animate-pulse ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"
          }`}></div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`h-32 rounded-xl animate-pulse ${
              theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"
            }`}></div>
          ))}
        </div>
      </div>
    );
  }

  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${textPrimary}`}>Painel</h1>
        <p className={`text-sm ${textSecondary}`}>
          Visão geral das suas métricas de trading
        </p>
      </div>

      {/* Filtros de Período */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-medium ${textSecondary}`}>Período:</span>
          {(["hoje", "ontem", "7dias", "15dias", "30dias", "60dias", "90dias"] as FiltroPeriodo[]).map((periodo) => (
            <button
              key={periodo}
              onClick={() => {
                setFiltroPeriodo(periodo);
                setDataInicio("");
                setDataFim("");
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtroPeriodo === periodo
                  ? theme === "dark"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900 text-white"
                  : theme === "dark"
                  ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {periodo === "hoje" && "Hoje"}
              {periodo === "ontem" && "Ontem"}
              {periodo === "7dias" && "7 dias"}
              {periodo === "15dias" && "15 dias"}
              {periodo === "30dias" && "30 dias"}
              {periodo === "60dias" && "60 dias"}
              {periodo === "90dias" && "90 dias"}
            </button>
          ))}
          <button
            onClick={() => setFiltroPeriodo("personalizado")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filtroPeriodo === "personalizado"
                ? theme === "dark"
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-900 text-white"
                : theme === "dark"
                ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            Personalizado
          </button>
          {filtroPeriodo === "personalizado" && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border ${inputBorder} ${inputBg} ${inputText} text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                placeholder="Data inicial"
              />
              <span className={textTertiary}>até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border ${inputBorder} ${inputBg} ${inputText} text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                placeholder="Data final"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sequências de Greens - Movida para cima e animada */}
      {sequenciasGreens.length > 0 && (
        <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4 animate-fade-in-down`}>
          <div className={`text-sm font-semibold mb-3 ${textPrimary}`}>
            Sequências de Greens
          </div>
          <div className="flex flex-wrap gap-2">
            {sequenciasGreens.slice(0, 10).map((seq, index) => (
              <div
                key={index}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ease-out hover:scale-105 cursor-default animate-fade-in-left ${
                  theme === "dark"
                    ? "bg-green-900/30 border border-green-800 text-green-400 hover:bg-green-900/40 hover:border-green-700"
                    : "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300"
                }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "both"
                }}
              >
                {seq} {seq === 1 ? "green" : "greens"}
              </div>
            ))}
            {sequenciasGreens.length > 10 && (
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${textTertiary}`}>
                +{sequenciasGreens.length - 10} mais
              </div>
            )}
          </div>
          {sequenciasGreens.length > 0 && (
            <div className={`mt-2 text-xs ${textTertiary}`}>
              Maior sequência: <span className="font-semibold text-green-500">{sequenciasGreens[0]}</span> {sequenciasGreens[0] === 1 ? "green" : "greens"}
            </div>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Total de Entradas */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          theme === "dark" 
            ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20" 
            : "hover:border-zinc-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              Total de Entradas
            </div>
          </div>
          <div className={`text-4xl font-bold mb-2 ${textPrimary}`}>
            {totalEntradas.toLocaleString("pt-BR")}
          </div>
          <div className={`text-xs ${textTertiary}`}>Operações realizadas</div>
        </div>

        {/* Greens */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          theme === "dark"
            ? "hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
            : "hover:border-green-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              Greens
            </div>
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
          </div>
          <div className="text-4xl font-bold text-green-500 mb-2">
            {greens.toLocaleString("pt-BR")}
          </div>
          <div className={`text-xs ${textTertiary}`}>Operações com lucro</div>
        </div>

        {/* Reds */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          theme === "dark"
            ? "hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10"
            : "hover:border-red-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              Reds
            </div>
            <div className="h-2 w-2 rounded-full bg-red-500"></div>
          </div>
          <div className="text-4xl font-bold text-red-500 mb-2">
            {reds.toLocaleString("pt-BR")}
          </div>
          <div className={`text-xs ${textTertiary}`}>Operações com prejuízo</div>
        </div>

        {/* Banca Inicial */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          theme === "dark"
            ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
            : "hover:border-zinc-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              Banca Inicial
            </div>
          </div>
          <div className={`text-3xl font-bold mb-2 ${textPrimary}`}>
            R$ {bancaInicial.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs ${textTertiary}`}>Capital inicial investido</div>
        </div>

        {/* Banca Atual */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          theme === "dark"
            ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
            : "hover:border-zinc-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              Banca Atual
            </div>
          </div>
          <div className={`text-3xl font-bold mb-2 ${textPrimary}`}>
            R$ {bancaAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs ${textTertiary}`}>Capital disponível</div>
        </div>

        {/* % Lucro sobre a Banca */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          lucroBanca >= 0
            ? theme === "dark"
              ? "hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
              : "hover:border-green-300 hover:shadow-md"
            : theme === "dark"
            ? "hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10"
            : "hover:border-red-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              % Lucro sobre Banca
            </div>
            <div className={`h-2 w-2 rounded-full ${lucroBanca >= 0 ? "bg-green-500" : "bg-red-500"}`}></div>
          </div>
          <div className={`text-4xl font-bold mb-2 ${lucroBanca >= 0 ? "text-green-500" : "text-red-500"}`}>
            {lucroBanca >= 0 ? "+" : ""}
            {lucroBanca.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </div>
          <div className={`text-xs ${textTertiary}`}>
            {lucroBanca >= 0 ? "Lucro" : "Prejuízo"} em relação à banca inicial
          </div>
        </div>

        {/* ROI */}
        <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
          roi >= 0
            ? theme === "dark"
              ? "hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
              : "hover:border-green-300 hover:shadow-md"
            : theme === "dark"
            ? "hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10"
            : "hover:border-red-300 hover:shadow-md"
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
              ROI
            </div>
            <div className={`h-2 w-2 rounded-full ${roi >= 0 ? "bg-green-500" : "bg-red-500"}`}></div>
          </div>
          <div className={`text-4xl font-bold mb-2 ${roi >= 0 ? "text-green-500" : "text-red-500"}`}>
            {roi >= 0 ? "+" : ""}
            {roi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </div>
          <div className={`text-xs ${textTertiary}`}>Retorno sobre investimento</div>
        </div>
      </div>

      {/* Casas de Apostas Recomendadas */}
      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Casas de Apostas Recomendadas
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <a
            href="https://www.lotogreen.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105 cursor-pointer ${
              theme === "dark"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <span>Lotogreen</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
          <a
            href="https://www.bet365.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-white transition-all hover:scale-105 cursor-pointer ${
              theme === "dark"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <span>Bet365</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
        <p className={`text-xs ${textTertiary}`}>
          Aposte com responsabilidade. Apenas para maiores de 18 anos.
        </p>
      </div>
    </div>
  );
}