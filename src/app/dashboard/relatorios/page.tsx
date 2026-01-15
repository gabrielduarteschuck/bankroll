"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

const MERCADOS_NBA = [
  "Pontos",
  "Assistências",
  "Rebotes",
  "Cestas de 3",
  "Resultado",
  "Pontos Totais",
  "Roubos",
  "Bloqueios",
  "Turnovers",
  "Faltas",
];

type Entrada = {
  id: string;
  stake_percent: number;
  valor_stake: number;
  odd: number;
  mercado: string | null;
  resultado: "green" | "red" | "pendente";
  valor_resultado: number | null;
  created_at: string;
};

type BancaData = {
  valor: number;
  created_at: string;
};

type FiltroPeriodo = "todos" | "hoje" | "ontem" | "7dias" | "15dias" | "30dias" | "60dias" | "90dias";

export default function RelatoriosPage() {
  const { theme } = useTheme();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [entradasFiltradas, setEntradasFiltradas] = useState<Entrada[]>([]);
  const [banca, setBanca] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos");
  const [filtroMercado, setFiltroMercado] = useState<string>("todos");

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterEntradas();
  }, [entradas, filtroPeriodo, filtroMercado]);

  function filterEntradas() {
    let filtered = [...entradas];

    // Filtro por período
    const now = new Date();
    const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    switch (filtroPeriodo) {
      case "hoje":
        filtered = filtered.filter((e) => {
          const dataEntrada = new Date(e.created_at);
          return dataEntrada >= hoje;
        });
        break;
      case "ontem":
        filtered = filtered.filter((e) => {
          const dataEntrada = new Date(e.created_at);
          return dataEntrada >= ontem && dataEntrada < hoje;
        });
        break;
      case "7dias":
        const seteDiasAtras = new Date(hoje);
        seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
        filtered = filtered.filter((e) => new Date(e.created_at) >= seteDiasAtras);
        break;
      case "15dias":
        const quinzeDiasAtras = new Date(hoje);
        quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);
        filtered = filtered.filter((e) => new Date(e.created_at) >= quinzeDiasAtras);
        break;
      case "30dias":
        const trintaDiasAtras = new Date(hoje);
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        filtered = filtered.filter((e) => new Date(e.created_at) >= trintaDiasAtras);
        break;
      case "60dias":
        const sessentaDiasAtras = new Date(hoje);
        sessentaDiasAtras.setDate(sessentaDiasAtras.getDate() - 60);
        filtered = filtered.filter((e) => new Date(e.created_at) >= sessentaDiasAtras);
        break;
      case "90dias":
        const noventaDiasAtras = new Date(hoje);
        noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);
        filtered = filtered.filter((e) => new Date(e.created_at) >= noventaDiasAtras);
        break;
      case "todos":
      default:
        // Não filtra por período
        break;
    }

    // Filtro por mercado
    if (filtroMercado !== "todos") {
      if (filtroMercado === "outros") {
        filtered = filtered.filter((e) => e.mercado && !MERCADOS_NBA.includes(e.mercado));
      } else {
        filtered = filtered.filter((e) => e.mercado === filtroMercado);
      }
    }

    setEntradasFiltradas(filtered);
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

      // Carrega entradas
      const { data: entradasData } = await supabase
        .from("entradas")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (entradasData) {
        setEntradas(entradasData as Entrada[]);
      }

      // Carrega banca
      const { data: bancaData } = await supabase
        .from("banca")
        .select("valor")
        .eq("user_id", user.id)
        .single();

      if (bancaData) {
        setBanca(bancaData.valor);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Cálculos gerais (usando entradas filtradas)
  const greens = entradasFiltradas.filter((e) => e.resultado === "green").length;
  const reds = entradasFiltradas.filter((e) => e.resultado === "red").length;
  const total = greens + reds;
  const percentGreen = total > 0 ? (greens / total) * 100 : 0;
  const percentRed = total > 0 ? (reds / total) * 100 : 0;

  // Novas métricas
  const lucroPrejuizo = entradasFiltradas.reduce((acc, e) => acc + (e.valor_resultado || 0), 0);
  const stakeTotal = entradasFiltradas.reduce((acc, e) => acc + (e.valor_stake || 0), 0);
  const oddsMedia = entradasFiltradas.length > 0
    ? entradasFiltradas.reduce((acc, e) => acc + (e.odd || 0), 0) / entradasFiltradas.length
    : 0;
  const winrate = total > 0 ? (greens / total) * 100 : 0;
  const bancaInicial = banca || 0;
  const roi = bancaInicial > 0 ? (lucroPrejuizo / bancaInicial) * 100 : 0;

  // Cálculos por mercado (usando entradas filtradas)
  type DesempenhoMercado = {
    mercado: string;
    total: number;
    greens: number;
    reds: number;
    resultadoTotal: number;
    percentGreen: number;
    percentRed: number;
  };

  const desempenhoPorMercado: DesempenhoMercado[] = entradasFiltradas
    .filter((e) => e.mercado && e.mercado.trim() !== "")
    .reduce((acc, entrada) => {
      const mercado = entrada.mercado || "Sem mercado";
      const existing = acc.find((m) => m.mercado === mercado);

      if (existing) {
        existing.total++;
        if (entrada.resultado === "green") existing.greens++;
        if (entrada.resultado === "red") existing.reds++;
        existing.resultadoTotal += entrada.valor_resultado || 0;
      } else {
        acc.push({
          mercado,
          total: 1,
          greens: entrada.resultado === "green" ? 1 : 0,
          reds: entrada.resultado === "red" ? 1 : 0,
          resultadoTotal: entrada.valor_resultado || 0,
          percentGreen: 0,
          percentRed: 0,
        });
      }

      return acc;
    }, [] as DesempenhoMercado[])
    .map((mercado) => {
      const totalMercado = mercado.greens + mercado.reds;
      return {
        ...mercado,
        percentGreen: totalMercado > 0 ? (mercado.greens / totalMercado) * 100 : 0,
        percentRed: totalMercado > 0 ? (mercado.reds / totalMercado) * 100 : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Dados para gráfico de desempenho da banca
  const somaResultados = entradasFiltradas.reduce((acc, e) => acc + (e.valor_resultado || 0), 0);
  const bancaAtual = bancaInicial + somaResultados;

  // Calcula evolução da banca ao longo do tempo
  const evolucaoBanca = entradasFiltradas.reduce(
    (acc, entrada) => {
      const valorAnterior = acc.length > 0 ? acc[acc.length - 1].valor : bancaInicial;
      const novoValor = valorAnterior + (entrada.valor_resultado || 0);
      acc.push({
        data: new Date(entrada.created_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        valor: novoValor,
        valorResultado: entrada.valor_resultado || 0,
        dataCompleta: new Date(entrada.created_at),
      });
      return acc;
    },
    [] as { data: string; valor: number; valorResultado: number; dataCompleta: Date }[]
  );

  // Encontra dias de maior lucro e maior perda
  const maiorLucro = evolucaoBanca.length > 0
    ? evolucaoBanca.reduce((max, e) => (e.valorResultado > max.valorResultado ? e : max), evolucaoBanca[0])
    : null;
  const maiorPerda = evolucaoBanca.length > 0
    ? evolucaoBanca.reduce((min, e) => (e.valorResultado < min.valorResultado ? e : min), evolucaoBanca[0])
    : null;

  // Projeções
  const diasComDados = entradasFiltradas.length > 0
    ? Math.max(
        1,
        Math.ceil(
          (new Date(entradasFiltradas[entradasFiltradas.length - 1].created_at).getTime() -
            new Date(entradasFiltradas[0].created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 1;

  const resultadoPorDia = somaResultados / diasComDados;
  const projecao30 = bancaAtual + resultadoPorDia * 30;
  const projecao90 = bancaAtual + resultadoPorDia * 90;
  const projecao180 = bancaAtual + resultadoPorDia * 180;

  // Componente de gráfico de pizza (estilo bolinha)
  function PieChart({ percentGreen, percentRed }: { percentGreen: number; percentRed: number }) {
    const size = 200;
    const radius = 80;
    const centerX = size / 2;
    const centerY = size / 2;
    const circumference = 2 * Math.PI * radius;

    const greenOffset = circumference - (percentGreen / 100) * circumference;
    const redOffset = circumference - (percentRed / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="#ef4444"
            strokeWidth="30"
          />
          {percentGreen > 0 && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="#22c55e"
              strokeWidth="30"
              strokeDasharray={circumference}
              strokeDashoffset={greenOffset}
              strokeLinecap="round"
            />
          )}
          {percentRed > 0 && (
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="none"
              stroke="#dc2626"
              strokeWidth="30"
              strokeDasharray={circumference}
              strokeDashoffset={greenOffset + redOffset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="mt-4 text-center">
          <div className={`text-3xl font-bold ${textPrimary}`}>
            {percentGreen.toFixed(1)}%
          </div>
          <div className={`text-sm ${textTertiary}`}>Green</div>
        </div>
      </div>
    );
  }

  // Componente de gráfico de linha (desempenho da banca)
  function LineChart({ data }: { data: { data: string; valor: number; valorResultado: number; dataCompleta: Date }[] }) {
    if (data.length === 0) {
      return (
        <div className={`h-64 flex items-center justify-center ${textTertiary}`}>
          Sem dados suficientes para o gráfico
        </div>
      );
    }

    const maxValor = Math.max(...data.map((d) => d.valor), bancaInicial);
    const minValor = Math.min(...data.map((d) => d.valor), bancaInicial);
    const range = maxValor - minValor || 1;
    const height = 200;
    const width = 600;
    const padding = 40;

    const points = data.map((d, i) => {
      const x = padding + (i * (width - 2 * padding)) / (data.length - 1 || 1);
      const y = height - padding - ((d.valor - minValor) / range) * (height - 2 * padding);
      return { x, y, ...d };
    });

    const pathData =
      points.length > 0
        ? `M ${points[0].x} ${points[0].y} ` +
          points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ")
        : "";

    const maiorLucroPoint = maiorLucro
      ? points.find((p) => p.dataCompleta.getTime() === maiorLucro.dataCompleta.getTime())
      : null;
    const maiorPerdaPoint = maiorPerda
      ? points.find((p) => p.dataCompleta.getTime() === maiorPerda.dataCompleta.getTime())
      : null;

    return (
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="w-full">
          {/* Linha de referência (banca inicial) */}
          <line
            x1={padding}
            y1={height - padding - ((bancaInicial - minValor) / range) * (height - 2 * padding)}
            x2={width - padding}
            y2={height - padding - ((bancaInicial - minValor) / range) * (height - 2 * padding)}
            stroke={theme === "dark" ? "#475569" : "#94a3b8"}
            strokeWidth="1"
            strokeDasharray="5,5"
          />
          {/* Linha */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pontos */}
          {points.map((point, i) => (
            <circle
              key={i}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#3b82f6"
              className="hover:r-6 transition-all"
            />
          ))}
          {/* Marcador de maior lucro */}
          {maiorLucroPoint && maiorLucroPoint.valorResultado > 0 && (
            <g>
              <circle
                cx={maiorLucroPoint.x}
                cy={maiorLucroPoint.y}
                r="8"
                fill="#22c55e"
                stroke="#fff"
                strokeWidth="2"
              />
              <circle
                cx={maiorLucroPoint.x}
                cy={maiorLucroPoint.y}
                r="12"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                opacity="0.5"
                className="animate-ping"
              />
            </g>
          )}
          {/* Marcador de maior perda */}
          {maiorPerdaPoint && maiorPerdaPoint.valorResultado < 0 && (
            <g>
              <circle
                cx={maiorPerdaPoint.x}
                cy={maiorPerdaPoint.y}
                r="8"
                fill="#dc2626"
                stroke="#fff"
                strokeWidth="2"
              />
              <circle
                cx={maiorPerdaPoint.x}
                cy={maiorPerdaPoint.y}
                r="12"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                opacity="0.5"
                className="animate-ping"
              />
            </g>
          )}
        </svg>
        {/* Legenda */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500"></div>
            <span className={textTertiary}>Evolução da Banca</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 border-dashed border border-zinc-500"></div>
            <span className={textTertiary}>Banca Inicial</span>
          </div>
          {maiorLucroPoint && maiorLucroPoint.valorResultado > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className={textTertiary}>Maior Lucro</span>
            </div>
          )}
          {maiorPerdaPoint && maiorPerdaPoint.valorResultado < 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span className={textTertiary}>Maior Perda</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Relatórios</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Relatórios</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Análise de desempenho e projeções futuras
        </p>
      </div>

      {/* Filtros */}
      <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4`}>
        <div className="space-y-4">
          {/* Filtro por período */}
          <div>
            <span className={`text-sm font-medium ${textSecondary} mb-2 block`}>
              Filtrar por período:
            </span>
            <div className="flex flex-wrap gap-2">
              {(["todos", "hoje", "ontem", "7dias", "15dias", "30dias", "60dias", "90dias"] as FiltroPeriodo[]).map((periodo) => (
                <button
                  key={periodo}
                  onClick={() => setFiltroPeriodo(periodo)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    filtroPeriodo === periodo
                      ? theme === "dark"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-900 text-white"
                      : theme === "dark"
                      ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {periodo === "todos" && "Todos"}
                  {periodo === "hoje" && "Hoje"}
                  {periodo === "ontem" && "Ontem"}
                  {periodo === "7dias" && "7 dias"}
                  {periodo === "15dias" && "15 dias"}
                  {periodo === "30dias" && "30 dias"}
                  {periodo === "60dias" && "60 dias"}
                  {periodo === "90dias" && "90 dias"}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro por mercado */}
          <div>
            <span className={`text-sm font-medium ${textSecondary} mb-2 block`}>
              Filtrar por mercado:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltroMercado("todos")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  filtroMercado === "todos"
                    ? theme === "dark"
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-900 text-white"
                    : theme === "dark"
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Todos
              </button>
              {MERCADOS_NBA.map((mercado) => (
                <button
                  key={mercado}
                  onClick={() => setFiltroMercado(mercado)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                    filtroMercado === mercado
                      ? theme === "dark"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-900 text-white"
                      : theme === "dark"
                      ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {mercado}
                </button>
              ))}
              <button
                onClick={() => setFiltroMercado("outros")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  filtroMercado === "outros"
                    ? theme === "dark"
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-900 text-white"
                    : theme === "dark"
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Outros
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className={`rounded-xl border ${cardBorder} ${
          theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
        } p-4`}>
          <div className={`text-xs font-medium ${textSecondary} mb-1`}>ROI (%)</div>
          <div className={`text-xl font-bold ${
            roi >= 0 ? "text-green-500" : "text-red-500"
          }`}>
            {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
          </div>
        </div>
        <div className={`rounded-xl border ${cardBorder} ${
          theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
        } p-4`}>
          <div className={`text-xs font-medium ${textSecondary} mb-1`}>Lucro/Prejuízo (R$)</div>
          <div className={`text-xl font-bold ${
            lucroPrejuizo >= 0 ? "text-green-500" : "text-red-500"
          }`}>
            {lucroPrejuizo >= 0 ? "+" : ""}R$ {lucroPrejuizo.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className={`rounded-xl border ${cardBorder} ${
          theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
        } p-4`}>
          <div className={`text-xs font-medium ${textSecondary} mb-1`}>Stake Total (R$)</div>
          <div className={`text-xl font-bold ${textPrimary}`}>
            R$ {stakeTotal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className={`rounded-xl border ${cardBorder} ${
          theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
        } p-4`}>
          <div className={`text-xs font-medium ${textSecondary} mb-1`}>Odds Média</div>
          <div className={`text-xl font-bold ${textPrimary}`}>
            {oddsMedia.toFixed(2)}
          </div>
        </div>
        <div className={`rounded-xl border ${cardBorder} ${
          theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
        } p-4`}>
          <div className={`text-xs font-medium ${textSecondary} mb-1`}>Winrate</div>
          <div className={`text-xl font-bold ${
            winrate >= 50 ? "text-green-500" : "text-red-500"
          }`}>
            {winrate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico Greens/Reds */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Greens vs Reds
          </h2>
          {total > 0 ? (
            <div className="flex flex-col items-center">
              <PieChart percentGreen={percentGreen} percentRed={percentRed} />
              <div className="mt-6 grid grid-cols-2 gap-4 w-full">
                <div className={`text-center p-4 rounded-lg border-2 ${
                  theme === "dark" 
                    ? "bg-green-900/20 border-green-800" 
                    : "bg-green-50 border-green-500"
                }`}>
                  <div className={`text-2xl font-bold ${
                    theme === "dark" ? "text-green-400" : "text-green-900"
                  }`}>
                    {greens}
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${
                    theme === "dark" ? "text-green-400" : "text-green-700"
                  }`}>
                    Greens
                  </div>
                  <div className={`text-xs ${
                    theme === "dark" ? "text-green-400" : "text-green-600"
                  }`}>
                    {percentGreen.toFixed(1)}%
                  </div>
                </div>
                <div className={`text-center p-4 rounded-lg border-2 ${
                  theme === "dark" 
                    ? "bg-red-900/20 border-red-800" 
                    : "bg-red-50 border-red-500"
                }`}>
                  <div className={`text-2xl font-bold ${
                    theme === "dark" ? "text-red-400" : "text-red-900"
                  }`}>
                    {reds}
                  </div>
                  <div className={`text-xs font-semibold mt-1 ${
                    theme === "dark" ? "text-red-400" : "text-red-700"
                  }`}>
                    Reds
                  </div>
                  <div className={`text-xs ${
                    theme === "dark" ? "text-red-400" : "text-red-600"
                  }`}>
                    {percentRed.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`h-64 flex items-center justify-center ${textTertiary}`}>
              Sem dados suficientes
            </div>
          )}
        </div>

        {/* Gráfico Desempenho da Banca */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Desempenho da Banca
          </h2>
          {evolucaoBanca.length > 0 ? (
            <div>
              <LineChart data={evolucaoBanca} />
              <div className="mt-4 flex items-center justify-between text-sm">
                <div>
                  <div className={textTertiary}>Banca Inicial</div>
                  <div className={`font-semibold ${textPrimary}`}>
                    R$ {bancaInicial.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className={textTertiary}>Banca Atual</div>
                  <div
                    className={`font-semibold ${
                      bancaAtual >= bancaInicial ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    R$ {bancaAtual.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className={`h-64 flex items-center justify-center ${textTertiary}`}>
              Sem dados suficientes
            </div>
          )}
        </div>
      </div>

      {/* Projeções */}
      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Projeções (se manter o mesmo ritmo)
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`rounded-xl border ${cardBorder} ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
          } p-5`}>
            <div className={`text-sm font-medium ${textSecondary} mb-2`}>30 Dias</div>
            <div
              className={`text-2xl font-bold ${
                projecao30 >= bancaAtual ? "text-green-500" : "text-red-500"
              }`}
            >
              R$ {projecao30.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className={`text-xs ${textTertiary} mt-1`}>
              {projecao30 >= bancaAtual ? "+" : ""}
              R${" "}
              {(projecao30 - bancaAtual).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className={`rounded-xl border ${cardBorder} ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
          } p-5`}>
            <div className={`text-sm font-medium ${textSecondary} mb-2`}>90 Dias</div>
            <div
              className={`text-2xl font-bold ${
                projecao90 >= bancaAtual ? "text-green-500" : "text-red-500"
              }`}
            >
              R$ {projecao90.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className={`text-xs ${textTertiary} mt-1`}>
              {projecao90 >= bancaAtual ? "+" : ""}
              R${" "}
              {(projecao90 - bancaAtual).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className={`rounded-xl border ${cardBorder} ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
          } p-5`}>
            <div className={`text-sm font-medium ${textSecondary} mb-2`}>180 Dias</div>
            <div
              className={`text-2xl font-bold ${
                projecao180 >= bancaAtual ? "text-green-500" : "text-red-500"
              }`}
            >
              R$ {projecao180.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className={`text-xs ${textTertiary} mt-1`}>
              {projecao180 >= bancaAtual ? "+" : ""}
              R${" "}
              {(projecao180 - bancaAtual).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>
        <div className={`mt-4 text-xs ${textTertiary}`}>
          * Projeções baseadas no desempenho médio diário dos últimos{" "}
          {diasComDados} dia(s)
        </div>
      </div>

      {/* Desempenho por Mercado */}
      {desempenhoPorMercado.length > 0 && (
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-6`}>
            Desempenho por Mercado
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {desempenhoPorMercado.map((mercado) => (
              <div
                key={mercado.mercado}
                className={`rounded-xl border ${cardBorder} ${
                  theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
                } p-4`}
              >
                <div className={`text-sm font-semibold ${textPrimary} mb-3`}>
                  {mercado.mercado}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textTertiary}`}>Total</span>
                    <span className={`text-sm font-medium ${textPrimary}`}>
                      {mercado.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textTertiary}`}>Greens</span>
                    <span className="text-sm font-medium text-green-500">
                      {mercado.greens} ({mercado.percentGreen.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${textTertiary}`}>Reds</span>
                    <span className="text-sm font-medium text-red-500">
                      {mercado.reds} ({mercado.percentRed.toFixed(1)}%)
                    </span>
                  </div>
                  <div className={`pt-2 border-t ${cardBorder}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${textTertiary}`}>Resultado</span>
                      <span
                        className={`text-sm font-semibold ${
                          mercado.resultadoTotal >= 0
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                      >
                        {mercado.resultadoTotal >= 0 ? "+" : ""}
                        R${" "}
                        {mercado.resultadoTotal.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
