"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  const [lucroLiquido, setLucroLiquido] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("7dias");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const { theme } = useTheme();

  useEffect(() => {
    loadData();
  }, [filtroPeriodo, dataInicio, dataFim]);

  function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number(String(value));
    return Number.isFinite(n) ? n : 0;
  }

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

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Busca banca (fallback automático caso a coluna stake_base ainda não exista)
      let bancaData: any = null;
      let bancaError: any = null;

      {
        const res = await supabase
          .from("banca")
          .select("valor, stake_base")
          .eq("user_id", user.id)
          .single();
        bancaData = res.data;
        bancaError = res.error;
      }

      const stakeBaseMissing =
        !!bancaError &&
        typeof bancaError?.message === "string" &&
        bancaError.message.toLowerCase().includes("stake_base");

      if (stakeBaseMissing) {
        const res2 = await supabase
          .from("banca")
          .select("valor")
          .eq("user_id", user.id)
          .single();
        bancaData = res2.data;
        bancaError = res2.error;
      }

      if (bancaError && bancaError.code !== "PGRST116") {
        console.error("Erro ao carregar banca:", {
          code: bancaError.code,
          message: bancaError.message,
          details: bancaError.details,
          hint: bancaError.hint,
        });
      }

      const bancaInicialNum = bancaData ? toNumber(bancaData.valor) : 0;

      if (bancaInicialNum > 0) {
        setBancaInicial(bancaInicialNum);
        setBancaAtual(bancaInicialNum);
      }

      // Calcula range de datas
      const { inicio, fim } = getDateRange();

      // Busca entradas com filtro de data
      const query = supabase
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

        // Calcula banca atual (banca inicial + soma dos resultados)
        const somaResultados = entradasData.reduce((acc, entrada) => {
          if (entrada.valor_resultado !== null && entrada.valor_resultado !== undefined) {
            return acc + toNumber(entrada.valor_resultado);
          }
          return acc;
        }, 0);
        setLucroLiquido(somaResultados);

        if (bancaData) {
          const novaBanca = bancaInicialNum + somaResultados;
          setBancaAtual(novaBanca);
        }

        // Calcula lucro sobre a banca
        if (bancaInicialNum > 0) {
          const lucro = (somaResultados / bancaInicialNum) * 100;
          setLucroBanca(lucro);
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

  const totalDecididas = greens + reds;
  const assertividade = totalDecididas > 0 ? (greens / totalDecididas) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${textPrimary}`}>Painel</h1>
        <p className={`text-sm ${textSecondary}`}>
          Visão geral das suas métricas de trading
        </p>
      </div>

      {/* Filtro (uma opção) */}
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

      {/* Cards (ordem e compactação pedidas) */}
      <div className="space-y-6">
        {/* Saldo Atual */}
        <div className="grid grid-cols-1">
          <div
            className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
              theme === "dark"
                ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
                : "hover:border-zinc-300 hover:shadow-md"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg border ${
                    theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={theme === "dark" ? "h-5 w-5 text-zinc-200" : "h-5 w-5 text-zinc-700"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7h18M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 15h4" />
                  </svg>
                </div>

                <div>
                  <div className={`text-sm font-semibold ${textPrimary}`}>Saldo Atual</div>
                  <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap font-bold tabular-nums">
                    <span className={`text-3xl sm:text-4xl ${textPrimary}`}>R$</span>
                    <span className={`text-3xl sm:text-4xl ${textPrimary}`}>
                      {bancaAtual.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className={`mt-1 text-sm ${textSecondary} whitespace-nowrap tabular-nums`}>
                    <span>Saldo Inicial: </span>
                    <span className="font-semibold">R$</span>{" "}
                    <span className="font-semibold">
                      {bancaInicial.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {/* % sobre a banca (desktop) em badge verde/vermelho */}
                  <div className="mt-2 hidden sm:block">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap tabular-nums ${
                        lucroBanca >= 0
                          ? theme === "dark"
                            ? "border-green-800 bg-green-900/20 text-green-200"
                            : "border-green-200 bg-green-50 text-green-700"
                          : theme === "dark"
                          ? "border-red-800 bg-red-900/20 text-red-200"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={lucroBanca >= 0 ? "M3 17l6-6 4 4 7-7" : "M3 7l6 6 4-4 7 7"}
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={lucroBanca >= 0 ? "M14 7h7v7" : "M21 17h-7v-7"}
                        />
                      </svg>
                      <span>
                        {lucroBanca >= 0 ? "+" : ""}
                        {lucroBanca.toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-start sm:items-end gap-2">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap tabular-nums ${
                    lucroLiquido >= 0
                      ? theme === "dark"
                        ? "border-green-800 bg-green-900/20 text-green-200"
                        : "border-green-200 bg-green-50 text-green-700"
                      : theme === "dark"
                      ? "border-red-800 bg-red-900/20 text-red-200"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={lucroLiquido >= 0 ? "M3 17l6-6 4 4 7-7" : "M3 7l6 6 4-4 7 7"}
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={lucroLiquido >= 0 ? "M14 7h7v7" : "M21 17h-7v-7"}
                    />
                  </svg>
                  <span className="whitespace-nowrap">
                    {lucroLiquido >= 0 ? "+" : ""}R${" "}
                    {lucroLiquido.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Badge no mobile, alinhado com o início do valor */}
            <div className="mt-4 ml-12 sm:hidden">
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap tabular-nums ${
                  lucroLiquido >= 0
                    ? theme === "dark"
                      ? "border-green-800 bg-green-900/20 text-green-200"
                      : "border-green-200 bg-green-50 text-green-700"
                    : theme === "dark"
                    ? "border-red-800 bg-red-900/20 text-red-200"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={lucroLiquido >= 0 ? "M3 17l6-6 4 4 7-7" : "M3 7l6 6 4-4 7 7"}
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={lucroLiquido >= 0 ? "M14 7h7v7" : "M21 17h-7v-7"}
                  />
                </svg>
                <span className="whitespace-nowrap">
                  {lucroLiquido >= 0 ? "+" : ""}R${" "}
                  {lucroLiquido.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  ({lucroBanca >= 0 ? "+" : ""}
                  {lucroBanca.toLocaleString("pt-BR", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  %)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Assertividade / Lucro Líquido */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div
            className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
              theme === "dark"
                ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
                : "hover:border-zinc-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Assertividade
              </div>
            </div>
            <div className={`text-4xl font-bold mb-2 ${textPrimary}`}>
              {assertividade.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </div>
            <div className={`text-xs ${textTertiary}`}>
              {totalDecididas > 0
                ? `${greens} greens em ${totalDecididas} entradas decididas`
                : "Sem entradas decididas no período"}
            </div>
          </div>

          <div
            className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
              lucroLiquido >= 0
                ? theme === "dark"
                  ? "hover:border-green-500/30 hover:shadow-lg hover:shadow-green-500/10"
                  : "hover:border-green-300 hover:shadow-md"
                : theme === "dark"
                ? "hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/10"
                : "hover:border-red-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Lucro Líquido
              </div>
              <div className={`h-2 w-2 rounded-full ${lucroLiquido >= 0 ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            <div className={`text-4xl font-bold mb-2 ${lucroLiquido >= 0 ? "text-green-500" : "text-red-500"}`}>
              {lucroLiquido >= 0 ? "+" : ""}
              R${" "}
              {lucroLiquido.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className={`text-xs ${textTertiary}`}>Soma dos resultados no período</div>
          </div>
        </div>

        {/* Total de Entradas */}
        <div className="grid grid-cols-1">
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
        </div>

        {/* Greens / Reds lado a lado */}
        <div className="grid grid-cols-2 gap-6">
        {/* Total de Entradas */}
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
        </div>

        {/* Banca Inicial / Banca Atual lado a lado */}
        <div className="grid grid-cols-2 gap-6">
          <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
            theme === "dark"
              ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
              : "hover:border-zinc-300 hover:shadow-md"
          } text-center`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Banca Inicial
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-center gap-2 whitespace-nowrap font-bold tabular-nums">
              <span className={`text-2xl sm:text-3xl ${textPrimary}`}>R$</span>
              <span className={`text-2xl sm:text-3xl ${textPrimary}`}>
                {bancaInicial.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={`text-xs ${textTertiary}`}>Capital inicial investido</div>
          </div>

          <div className={`group relative overflow-hidden rounded-xl ${cardBg} border ${cardBorder} p-6 transition-all ${
            theme === "dark"
              ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20"
              : "hover:border-zinc-300 hover:shadow-md"
          } text-center`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                Banca Atual
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-center gap-2 whitespace-nowrap font-bold tabular-nums">
              <span className={`text-2xl sm:text-3xl ${textPrimary}`}>R$</span>
              <span className={`text-2xl sm:text-3xl ${textPrimary}`}>
                {bancaAtual.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className={`text-xs ${textTertiary}`}>Capital disponível</div>
          </div>
        </div>

        {/* % Lucro sobre a banca */}
        <div className="grid grid-cols-1">
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
              Lucro/Prejuizo em relação a banca inicial
            </div>
          </div>
        </div>
      </div>

      {/* Casas de Apostas Recomendadas */}
      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Casas Indicadas
        </h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <a
            href="https://go.aff.esportiva.bet/s0gwocy0"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" aria-hidden="true" />
            <span>Esportiva</span>
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
            href="https://www.bet365.bet.br/hub/pt-br/open-account?affiliate=365_03711474"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
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

      {/* Grupos de palpites indicados */}
      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-2`}>
          Salas Indicadas
        </h2>
        <p className={`text-xs ${textTertiary} mb-4`}>
          Entre nos grupos recomendados para receber palpites e análises (NBA e Futebol).
        </p>

        <div className="grid grid-cols-2 gap-3">
          <a
            href="https://t.me/+TTjhM_Pm_RlkN2Nh"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M21.9 4.6c.2-1-0.7-1.7-1.6-1.3L2.6 10.3c-1 .4-.9 1.8.1 2.2l4.7 1.8 1.8 5.7c.3 1.1 1.7 1.2 2.2.3l2.8-4.9 4.9 3.6c.8.6 1.9.1 2.1-.9l2.5-13.5ZM8.4 13.3l9.8-6.1c.2-.1.4.2.2.3l-8.1 7.4-.3 3.9c0 .3-.4.4-.5.1l-1.3-4-3.8-1.5c-.3-.1-.3-.5 0-.6l13.5-5.3-9.5 5.8Z" />
            </svg>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden="true" />
              Basquete tips
            </span>
          </a>

          <a
            href="https://t.me/+cfgSnGAJ82FiYzQx"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-zinc-800 bg-zinc-800/80 text-zinc-100 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
            }`}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M21.9 4.6c.2-1-0.7-1.7-1.6-1.3L2.6 10.3c-1 .4-.9 1.8.1 2.2l4.7 1.8 1.8 5.7c.3 1.1 1.7 1.2 2.2.3l2.8-4.9 4.9 3.6c.8.6 1.9.1 2.1-.9l2.5-13.5ZM8.4 13.3l9.8-6.1c.2-.1.4.2.2.3l-8.1 7.4-.3 3.9c0 .3-.4.4-.5.1l-1.3-4-3.8-1.5c-.3-.1-.3-.5 0-.6l13.5-5.3-9.5 5.8Z" />
            </svg>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" aria-hidden="true" />
              Futebol tips
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}