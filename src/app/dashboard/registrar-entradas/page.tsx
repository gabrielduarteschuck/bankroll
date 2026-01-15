"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

const STAKES_PREDEFINIDAS = [0.2, 0.5, 1, 2, 5];

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

export default function RegistrarEntradasPage() {
  const { theme } = useTheme();
  const [bancaInicial, setBancaInicial] = useState<number | null>(null);
  const [bancaAtual, setBancaAtual] = useState<number | null>(null);
  const [stakeSelecionada, setStakeSelecionada] = useState<string>("");
  const [stakeCustomizada, setStakeCustomizada] = useState<string>("");
  const [mostrarStake, setMostrarStake] = useState<boolean>(false);
  const [odd, setOdd] = useState<string>("");
  const [esporte, setEsporte] = useState<string>("");
  const [esporteCustomizado, setEsporteCustomizado] = useState<string>("");
  const [mostrarEsporte, setMostrarEsporte] = useState<boolean>(false);
  const [mercadoTexto, setMercadoTexto] = useState<string>("");
  const [sugestoesMercado, setSugestoesMercado] = useState<string[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState<boolean>(false);
  const [resultado, setResultado] = useState<"green" | "red" | "">("");
  const [valorApostado, setValorApostado] = useState<number>(0);
  const [valorResultado, setValorResultado] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingBanca, setLoadingBanca] = useState(true);

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";
  const hoverBg = theme === "dark" ? "hover:bg-zinc-800" : "hover:bg-zinc-50";
  const infoBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-50";

  useEffect(() => {
    loadBanca();
  }, []);

  useEffect(() => {
    calculateValues();
  }, [bancaInicial, stakeSelecionada, stakeCustomizada, odd, resultado]);

  useEffect(() => {
    // Carrega sugestões de mercado quando o esporte muda
    loadSugestoesMercado();
    // Limpa o mercado ao trocar esporte para não “vazar” de outro esporte
    setMercadoTexto("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esporte, esporteCustomizado]);

  function esporteFinalValue() {
    return esporte === "outros" ? esporteCustomizado.trim() : esporte.trim();
  }

  async function loadSugestoesMercado() {
    const esporteFinal = esporteFinalValue();
    if (!esporteFinal) {
      setSugestoesMercado([]);
      return;
    }

    setLoadingSugestoes(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("mercados_sugeridos")
        .select("mercado")
        .eq("user_id", user.id)
        .eq("esporte", esporteFinal)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        // Se a migração não foi aplicada ainda, não quebra a tela
        setSugestoesMercado([]);
        return;
      }

      const unique = Array.from(
        new Set(
          (data || [])
            .map((r: any) => String(r.mercado || "").trim())
            .filter(Boolean)
        )
      );
      setSugestoesMercado(unique);
    } finally {
      setLoadingSugestoes(false);
    }
  }

  async function loadBanca() {
    try {
      setLoadingBanca(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoadingBanca(false);
        return;
      }

      // Busca a banca inicial do banco
      const { data: bancaData, error: bancaError } = await supabase
        .from("banca")
        .select("valor")
        .eq("user_id", user.id)
        .single();

      if (bancaError && bancaError.code !== "PGRST116") {
        console.error("Erro ao carregar banca:", bancaError);
        setLoadingBanca(false);
        return;
      }

      const bancaInicialValue = bancaData?.valor || 0;
      setBancaInicial(bancaInicialValue);

      // Busca entradas para calcular banca atual
      const { data: entradasData, error: entradasError } = await supabase
        .from("entradas")
        .select("valor_resultado")
        .eq("user_id", user.id);

      if (entradasError) {
        console.error("Erro ao carregar entradas:", entradasError);
        setBancaAtual(bancaInicialValue);
        setLoadingBanca(false);
        return;
      }

      // Calcula banca atual (banca inicial + soma dos resultados)
      const somaResultados = (entradasData || []).reduce((acc, entrada) => {
        if (entrada.valor_resultado !== null) {
          return acc + parseFloat(entrada.valor_resultado.toString());
        }
        return acc;
      }, 0);

      const bancaAtualValue = bancaInicialValue + somaResultados;
      setBancaAtual(bancaAtualValue);
    } catch (error) {
      console.error("Erro ao carregar banca:", error);
    } finally {
      setLoadingBanca(false);
    }
  }

  function calculateValues() {
    if (!bancaInicial || bancaInicial <= 0) {
      setValorApostado(0);
      setValorResultado(0);
      return;
    }

    // Calcula valor apostado (stake) - usa banca inicial
    let percentStake = 0;

    if (stakeSelecionada === "custom") {
      const customValue = parseFloat(stakeCustomizada.replace(",", "."));
      if (!isNaN(customValue) && customValue > 0) {
        percentStake = customValue;
      }
    } else if (stakeSelecionada) {
      percentStake = parseFloat(stakeSelecionada);
    }

    const valorApostadoCalculado =
      percentStake > 0 ? (bancaInicial * percentStake) / 100 : 0;
    setValorApostado(valorApostadoCalculado);

    // Calcula resultado se tiver odd e resultado selecionado
    if (odd && resultado && valorApostadoCalculado > 0) {
      const oddValue = parseFloat(odd.replace(",", "."));
      if (!isNaN(oddValue) && oddValue > 0) {
        if (resultado === "green") {
          // Green: (valor apostado * odd) - valor apostado
          const lucro = valorApostadoCalculado * oddValue - valorApostadoCalculado;
          setValorResultado(lucro);
        } else if (resultado === "red") {
          // Red: -valor apostado
          setValorResultado(-valorApostadoCalculado);
        }
      } else {
        setValorResultado(0);
      }
    } else {
      setValorResultado(0);
    }
  }

  function handleStakeChange(value: string) {
    setStakeSelecionada(value);
    if (value !== "custom") {
      setStakeCustomizada("");
    }
  }

  function stakeLabel() {
    if (!stakeSelecionada) return "";
    if (stakeSelecionada === "custom") {
      return stakeCustomizada.trim() ? `${stakeCustomizada}%` : "Outra (customizada)";
    }
    return `${stakeSelecionada}%`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Usuário não autenticado");
        setLoading(false);
        return;
      }

      if (!bancaInicial || bancaInicial <= 0) {
        alert("Por favor, defina uma banca primeiro na página 'Banca'");
        setLoading(false);
        return;
      }

      if (!stakeSelecionada) {
        alert("Por favor, selecione uma stake");
        setLoading(false);
        return;
      }

      if (!odd || odd === "") {
        alert("Por favor, insira a odd");
        setLoading(false);
        return;
      }

      if (!resultado) {
        alert("Por favor, selecione se foi Green ou Red");
        setLoading(false);
        return;
      }

      let percentStake = 0;

      if (stakeSelecionada === "custom") {
        const customValue = parseFloat(stakeCustomizada.replace(",", "."));
        if (isNaN(customValue) || customValue <= 0) {
          alert("Por favor, insira um valor válido para a stake customizada");
          setLoading(false);
          return;
        }
        percentStake = customValue;
      } else {
        percentStake = parseFloat(stakeSelecionada);
      }

      const oddValue = parseFloat(odd.replace(",", "."));
      if (isNaN(oddValue) || oddValue <= 0) {
        alert("Por favor, insira uma odd válida");
        setLoading(false);
        return;
      }

      const esporteFinal = esporteFinalValue();
      if (!esporteFinal) {
        alert("Por favor, selecione um esporte");
        setLoading(false);
        return;
      }

      // Mercado é OPCIONAL
      const mercadoFinal = mercadoTexto.trim() ? mercadoTexto.trim() : null;

      // Salva a entrada no banco de dados
      const { error: insertError } = await supabase.from("entradas").insert({
        user_id: user.id,
        stake_percent: percentStake,
        valor_stake: valorApostado,
        odd: oddValue,
        esporte: esporteFinal,
        mercado: mercadoFinal,
        resultado: resultado,
        valor_resultado: valorResultado,
      });

      if (insertError) {
        console.error("Erro ao salvar entrada:", insertError);
        
        if (insertError.message.includes("Could not find the table") || insertError.message.includes("relation") || insertError.message.includes("does not exist")) {
          alert(
            `❌ Tabela 'entradas' não encontrada!\n\n` +
            `📋 Para resolver:\n` +
            `1. Acesse: https://supabase.com/dashboard\n` +
            `2. Vá em "SQL Editor"\n` +
            `3. Execute o arquivo "CRIAR-TUDO.sql"\n\n` +
            `Este script cria a tabela com todos os campos necessários!`
          );
        } else if (
          (insertError.message.includes("esporte") && insertError.message.includes("column")) ||
          insertError.message.includes("esporte does not exist")
        ) {
          alert(
            `❌ Coluna 'esporte' não encontrada na tabela 'entradas'!\n\n` +
            `📋 Para resolver:\n` +
            `1. Acesse: https://supabase.com/dashboard\n` +
            `2. Vá em \"SQL Editor\"\n` +
            `3. Execute a migration \"0009_esporte_e_sugestoes_mercado.sql\" (pasta supabase/migrations)\n\n` +
            `Isso adiciona a coluna 'esporte' e cria a tabela de sugestões.`
          );
        } else if (insertError.message.includes("mercado") || insertError.message.includes("column") && insertError.message.includes("mercado")) {
          alert(
            `❌ Coluna 'mercado' não encontrada na tabela 'entradas'!\n\n` +
            `📋 Para resolver:\n` +
            `1. Acesse: https://supabase.com/dashboard\n` +
            `2. Vá em "SQL Editor"\n` +
            `3. Execute o arquivo "ADICIONAR-COLUNA-MERCADO.sql"\n\n` +
            `Este script adiciona a coluna 'mercado' à tabela.`
          );
        } else {
          alert(
            `Erro ao salvar entrada: ${insertError.message}\n\n` +
            `Execute "CRIAR-TUDO.sql" no Supabase SQL Editor.`
          );
        }
        setLoading(false);
        return;
      }

      // Salva sugestão de mercado por esporte (best-effort)
      if (mercadoFinal) {
        try {
          await supabase
            .from("mercados_sugeridos")
            .upsert(
              { user_id: user.id, esporte: esporteFinal, mercado: mercadoFinal },
              { onConflict: "user_id,esporte,mercado", ignoreDuplicates: true }
            );
        } catch {
          // ignore
        }
      }

      // Limpa o formulário ANTES de mostrar o alert
      setStakeSelecionada("");
      setStakeCustomizada("");
      setOdd("");
      setEsporte("");
      setEsporteCustomizado("");
      setMercadoTexto("");
      setSugestoesMercado([]);
      setResultado("");
      setValorApostado(0);
      setValorResultado(0);

      alert(
        `✅ Entrada registrada com sucesso!\n\n` +
        `Esporte: ${esporteFinal}\n` +
        (mercadoFinal ? `Mercado: ${mercadoFinal}\n` : "") +
        `Stake: ${percentStake}%\n` +
        `Valor Apostado: R$ ${valorApostado.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}\n` +
        `Odd: ${oddValue.toFixed(2)}\n` +
        `Resultado: ${resultado === "green" ? "Green" : "Red"}\n` +
        `Valor Resultado: R$ ${valorResultado >= 0 ? "+" : ""}${valorResultado.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}\n\n` +
        `Acesse "Minhas Entradas" para ver todas as suas entradas.`
      );
    } catch (error) {
      console.error("Erro ao registrar entrada:", error);
      alert("Erro ao registrar entrada");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>
          Registrar Entradas
        </h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Registre uma nova entrada com stake, odd e resultado
        </p>
      </div>

      <div className="max-w-2xl">
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-6`}>
            Nova Entrada
          </h2>

          {loadingBanca ? (
            <div className={`mb-6 p-4 rounded-lg ${infoBg} border ${cardBorder}`}>
              <div className={`text-xs ${textTertiary} mb-1`}>Banca Atual</div>
              <div className={`text-2xl font-semibold ${textPrimary} animate-pulse`}>
                Carregando...
              </div>
            </div>
          ) : bancaAtual !== null && bancaAtual > 0 ? (
            <div className={`mb-6 p-4 rounded-lg ${infoBg} border ${cardBorder}`}>
              <div className={`text-xs ${textTertiary} mb-1`}>Banca Atual</div>
              <div className={`text-2xl font-semibold ${textPrimary}`}>
                R$ {bancaAtual.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              Você precisa definir uma banca primeiro. Acesse a página "Banca"
              para configurar.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Stake */}
            <div>
              <button
                type="button"
                onClick={() => setMostrarStake((v) => !v)}
                className={`w-full p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  mostrarStake
                    ? theme === "dark"
                      ? "border-zinc-600 bg-zinc-800"
                      : "border-zinc-400 bg-zinc-50"
                    : `${cardBorder} ${cardBg} ${hoverBg}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${textPrimary}`}>
                    Selecionar stake
                  </span>
                  <span className={`text-xs ${textTertiary}`}>
                    {stakeSelecionada ? `✓ ${stakeLabel()}` : "Clique para selecionar"}
                  </span>
                  <svg
                    className={`w-5 h-5 ${textTertiary} transition-transform ${
                      mostrarStake ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {mostrarStake && (
                <div className={`mt-3 space-y-2 p-4 rounded-lg border ${cardBorder} ${infoBg}`}>
                  {STAKES_PREDEFINIDAS.map((stake) => (
                    <label
                      key={stake}
                      className={`flex items-center p-3 rounded-lg border ${cardBorder} cursor-pointer ${hoverBg} transition-colors`}
                    >
                      <input
                        type="radio"
                        name="stake"
                        value={stake.toString()}
                        checked={stakeSelecionada === stake.toString()}
                        onChange={(e) => {
                          handleStakeChange(e.target.value);
                          setMostrarStake(false);
                        }}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {stake}%
                        </div>
                        {bancaInicial && bancaInicial > 0 && (
                          <div className={`text-xs ${textTertiary}`}>
                            R${" "}
                            {((bancaInicial * stake) / 100).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}

                  <label className={`flex items-center p-3 rounded-lg border ${cardBorder} cursor-pointer ${hoverBg} transition-colors`}>
                    <input
                      type="radio"
                      name="stake"
                      value="custom"
                      checked={stakeSelecionada === "custom"}
                      onChange={(e) => handleStakeChange(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${textPrimary} mb-1`}>
                        Outra (customizada)
                      </div>
                      {stakeSelecionada === "custom" && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Digite a stake (ex: 1.5)"
                            value={stakeCustomizada}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^\d,.-]/g, "");
                              setStakeCustomizada(value);
                            }}
                            className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                            required={stakeSelecionada === "custom"}
                          />
                          {stakeCustomizada.trim() ? (
                            <button
                              type="button"
                              onClick={() => setMostrarStake(false)}
                              className={`w-full px-3 py-2 rounded text-sm font-medium cursor-pointer transition-colors ${
                                theme === "dark"
                                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                                  : "bg-zinc-900 text-white hover:bg-zinc-800"
                              }`}
                            >
                              Confirmar
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Valor Apostado (calculado automaticamente) */}
            {valorApostado > 0 && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="text-xs text-blue-600 mb-1">Valor Apostado</div>
                <div className="text-xl font-semibold text-blue-700">
                  R$ {valorApostado.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Calculado automaticamente baseado na banca e stake
                </div>
              </div>
            )}

            {/* Odd */}
            <div>
              <label
                htmlFor="odd"
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Odd
              </label>
              <input
                type="text"
                id="odd"
                name="odd"
                inputMode="decimal"
                placeholder="Ex: 2.50"
                value={odd}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d,.-]/g, "");
                  setOdd(value);
                }}
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
                required
              />
            </div>

            {/* Esporte */}
            <div>
              <button
                type="button"
                onClick={() => setMostrarEsporte((v) => !v)}
                className={`w-full p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                  mostrarEsporte
                    ? theme === "dark"
                      ? "border-zinc-600 bg-zinc-800"
                      : "border-zinc-400 bg-zinc-50"
                    : `${cardBorder} ${cardBg} ${hoverBg}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${textPrimary}`}>
                    Selecionar esporte
                  </span>
                  <span className={`text-xs ${textTertiary}`}>
                    {esporteFinalValue()
                      ? `✓ ${esporteFinalValue()}`
                      : "Clique para selecionar"}
                  </span>
                  <svg
                    className={`w-5 h-5 ${textTertiary} transition-transform ${
                      mostrarEsporte ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {mostrarEsporte && (
                <div className={`mt-3 space-y-2 p-4 rounded-lg border ${cardBorder} ${infoBg}`}>
                  {ESPORTES_PREDEFINIDOS.map((sport) => (
                    <label
                      key={sport}
                      className={`flex items-center p-3 rounded-lg border ${cardBorder} cursor-pointer ${hoverBg} transition-colors`}
                    >
                      <input
                        type="radio"
                        name="esporte"
                        value={sport}
                        checked={esporte === sport}
                        onChange={(e) => {
                          setEsporte(e.target.value);
                          setEsporteCustomizado("");
                          setMostrarEsporte(false);
                        }}
                        className="mr-3"
                      />
                      <div className={`text-sm font-medium ${textPrimary}`}>{sport}</div>
                    </label>
                  ))}

                  <label className={`flex items-center p-3 rounded-lg border ${cardBorder} cursor-pointer ${hoverBg} transition-colors`}>
                    <input
                      type="radio"
                      name="esporte"
                      value="outros"
                      checked={esporte === "outros"}
                      onChange={(e) => {
                        setEsporte(e.target.value);
                        // mantém aberto para digitar
                      }}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${textPrimary} mb-1`}>Outro</div>
                      {esporte === "outros" && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Digite o esporte"
                            value={esporteCustomizado}
                            onChange={(e) => setEsporteCustomizado(e.target.value)}
                            className={`w-full p-2 rounded border ${inputBorder} ${inputBg} text-sm ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
                          />
                          {esporteCustomizado.trim() ? (
                            <button
                              type="button"
                              onClick={() => setMostrarEsporte(false)}
                              className={`w-full px-3 py-2 rounded text-sm font-medium cursor-pointer transition-colors ${
                                theme === "dark"
                                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                                  : "bg-zinc-900 text-white hover:bg-zinc-800"
                              }`}
                            >
                              Confirmar
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Mercado (opcional) + sugestões por esporte */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Mercado Utilizado <span className={`${textTertiary}`}>(opcional)</span>
              </label>
              <input
                type="text"
                placeholder={esporteFinalValue() ? "Ex: Ambas marcam, Handicap, Over 2.5..." : "Selecione um esporte primeiro"}
                value={mercadoTexto}
                onChange={(e) => setMercadoTexto(e.target.value)}
                disabled={!esporteFinalValue()}
                list="mercado-sugestoes"
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent disabled:opacity-60`}
              />
              <datalist id="mercado-sugestoes">
                {sugestoesMercado.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>

              {esporteFinalValue() && (
                <div className="mt-2">
                  <div className={`text-xs ${textTertiary}`}>
                    {loadingSugestoes ? "Carregando sugestões..." : sugestoesMercado.length > 0 ? "Sugestões:" : "Sem sugestões ainda — ao registrar, salvamos como sugestão."}
                  </div>
                  {sugestoesMercado.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sugestoesMercado.slice(0, 10).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMercadoTexto(m)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            theme === "dark"
                              ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resultado (Green/Red) */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-3`}>
                Resultado
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    resultado === "green"
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : `${cardBorder} ${hoverBg}`
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value="green"
                    checked={resultado === "green"}
                    onChange={(e) => setResultado(e.target.value as "green")}
                    className="mr-2"
                  />
                  <span
                    className={`font-semibold ${
                      resultado === "green" ? "text-green-700 dark:text-green-400" : textPrimary
                    }`}
                  >
                    Green
                  </span>
                </label>

                <label
                  className={`flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    resultado === "red"
                      ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                      : `${cardBorder} ${hoverBg}`
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value="red"
                    checked={resultado === "red"}
                    onChange={(e) => setResultado(e.target.value as "red")}
                    className="mr-2"
                  />
                  <span
                    className={`font-semibold ${
                      resultado === "red" ? "text-red-700 dark:text-red-400" : textPrimary
                    }`}
                  >
                    Red
                  </span>
                </label>
              </div>
            </div>

            {/* Valor Resultado (calculado automaticamente) */}
            {valorResultado !== 0 && (
              <div
                className={`p-4 rounded-lg border ${
                  valorResultado >= 0
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    valorResultado >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  Resultado Calculado
                </div>
                <div
                  className={`text-xl font-semibold ${
                    valorResultado >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {valorResultado >= 0 ? "+" : ""}
                  R${" "}
                  {valorResultado.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div
                  className={`text-xs mt-1 ${
                    valorResultado >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {resultado === "green"
                    ? `Lucro: (R$ ${valorApostado.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} × ${parseFloat(odd.replace(",", ".") || "0").toFixed(2)}) - R$ ${valorApostado.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `Prejuízo: -R$ ${valorApostado.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !bancaInicial || !stakeSelecionada || !odd || !resultado}
              className={`w-full p-4 rounded-lg font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                theme === "dark"
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {loading ? "Registrando..." : "Registrar Entrada"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
