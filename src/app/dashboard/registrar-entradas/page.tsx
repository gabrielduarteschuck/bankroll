"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useAnalytics } from "@/contexts/AnalyticsContext";

const STAKES_PREDEFINIDAS = [0.2, 0.5, 1, 2, 5];

type StakePersonalizada = {
  id: string;
  nome: string;
  percent: number;
};

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
  const router = useRouter();
  const { theme } = useTheme();
  const { trackEntradaRegistered } = useAnalytics();
  const [bancaInicial, setBancaInicial] = useState<number | null>(null);
  const [bancaAtual, setBancaAtual] = useState<number | null>(null);
  const [stakeBase, setStakeBase] = useState<number | null>(null);
  const [stakeSelecionada, setStakeSelecionada] = useState<string>("");
  const [stakeCustomizada, setStakeCustomizada] = useState<string>("");
  const [mostrarStake, setMostrarStake] = useState<boolean>(false);
  const [stakesPersonalizadas, setStakesPersonalizadas] = useState<StakePersonalizada[]>([]);
  const [odd, setOdd] = useState<string>("");
  const [esporte, setEsporte] = useState<string>("");
  const [esporteCustomizado, setEsporteCustomizado] = useState<string>("");
  const [mostrarEsporte, setMostrarEsporte] = useState<boolean>(false);
  const [mercadoTexto, setMercadoTexto] = useState<string>("");
  const [modalMercadoOpen, setModalMercadoOpen] = useState(false);
  const [novoMercadoNome, setNovoMercadoNome] = useState<string>("");
  const [savingMercado, setSavingMercado] = useState(false);
  const [descricao, setDescricao] = useState<string>("");
  const [sugestoesMercado, setSugestoesMercado] = useState<string[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState<boolean>(false);
  const lastSavedMercadoRef = useRef<{ esporte: string; mercado: string } | null>(
    null
  );
  const [resultado, setResultado] = useState<"pendente" | "green" | "red">(
    "pendente"
  );
  const [valorApostado, setValorApostado] = useState<number>(0);
  const [valorResultado, setValorResultado] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [loadingBanca, setLoadingBanca] = useState(true);

  // Toast de feedback
  const [toast, setToast] = useState<{
    show: boolean;
    bancaNova: number;
  } | null>(null);

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
    loadStakesPersonalizadas();
  }, []);

  useEffect(() => {
    calculateValues();
  }, [bancaInicial, stakeBase, stakeSelecionada, stakeCustomizada, odd, resultado]);

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
            .map((r: { mercado: string | null }) => String(r.mercado || "").trim())
            .filter(Boolean)
        )
      ) as string[];
      setSugestoesMercado(unique);
    } finally {
      setLoadingSugestoes(false);
    }
  }

  async function loadStakesPersonalizadas() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("stakes_personalizadas")
        .select("id, nome, percent")
        .eq("user_id", user.id)
        .order("percent", { ascending: true });

      if (error) {
        // best-effort: se a migration ainda não foi aplicada, não quebra a tela
        setStakesPersonalizadas([]);
        return;
      }

      setStakesPersonalizadas(
        (data || []).map((r: any) => ({
          id: String(r.id),
          nome: String(r.nome || "stake"),
          percent: Number(r.percent),
        }))
      );
    } catch {
      // ignore
    }
  }

  async function saveMercadoSugestaoIfNeeded() {
    const esporteFinal = esporteFinalValue();
    const mercadoFinal = mercadoTexto.trim();
    if (!esporteFinal || !mercadoFinal) return;

    // evita re-salvar o mesmo par esporte+mercado em sequência
    if (
      lastSavedMercadoRef.current?.esporte === esporteFinal &&
      lastSavedMercadoRef.current?.mercado === mercadoFinal
    ) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const mercado_norm = mercadoFinal.toLowerCase();
      const { error } = await supabase
        .from("mercados_sugeridos")
        .upsert(
          { user_id: user.id, esporte: esporteFinal, mercado: mercadoFinal, mercado_norm },
          { onConflict: "user_id,esporte,mercado_norm", ignoreDuplicates: true }
        );

      if (error) {
        // se a migration ainda não foi aplicada, não quebra a tela
        return;
      }

      lastSavedMercadoRef.current = { esporte: esporteFinal, mercado: mercadoFinal };
      await loadSugestoesMercado();
    } catch {
      // ignore
    }
  }

  async function handleAddMercado() {
    const esporteFinal = esporteFinalValue();
    if (!esporteFinal) {
      alert("Selecione um esporte antes de adicionar um mercado.");
      return;
    }

    const mercado = novoMercadoNome.trim();
    if (!mercado) return;

    setSavingMercado(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Usuário não autenticado");
        return;
      }

      const mercado_norm = mercado.toLowerCase();
      const { error } = await supabase
        .from("mercados_sugeridos")
        .upsert(
          { user_id: user.id, esporte: esporteFinal, mercado, mercado_norm },
          { onConflict: "user_id,esporte,mercado_norm", ignoreDuplicates: true }
        );

      if (error) {
        // Se a migration ainda não foi aplicada, não quebra — apenas não salva.
        console.warn("Falha ao salvar mercado:", error);
        alert("Não foi possível salvar o mercado. Tente novamente.");
        return;
      }

      // Atualiza sugestões e seleciona automaticamente
      await loadSugestoesMercado();
      setMercadoTexto(mercado);
      lastSavedMercadoRef.current = { esporte: esporteFinal, mercado };
      setModalMercadoOpen(false);
      setNovoMercadoNome("");
    } finally {
      setSavingMercado(false);
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

      // Busca a banca (fallback automático caso a coluna stake_base ainda não exista)
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
        setLoadingBanca(false);
        return;
      }

      const bancaInicialValue = bancaData?.valor || 0;
      setBancaInicial(bancaInicialValue);
      const stakeBaseValue =
        bancaData?.stake_base !== null && bancaData?.stake_base !== undefined
          ? Number(bancaData.stake_base)
          : bancaInicialValue;
      setStakeBase(stakeBaseValue);

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
      const somaResultados = (entradasData || []).reduce((acc: number, entrada: { valor_resultado: number | null }) => {
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

  function percentStakeFromSelection(): number {
    if (!stakeSelecionada) return 0;

    if (stakeSelecionada === "custom") {
      const customValue = parseFloat(stakeCustomizada.replace(",", "."));
      return !isNaN(customValue) && customValue > 0 ? customValue : 0;
    }

    if (stakeSelecionada.startsWith("ps:")) {
      const id = stakeSelecionada.slice(3);
      const found = stakesPersonalizadas.find((s) => s.id === id);
      return found ? Number(found.percent) : 0;
    }

    const parsed = parseFloat(stakeSelecionada);
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }

  function calculateValues() {
    const base = (stakeBase ?? bancaInicial) ?? 0;
    if (!base || base <= 0) {
      setValorApostado(0);
      setValorResultado(0);
      return;
    }

    // Calcula valor apostado (stake) - usa banca inicial
    const percentStake = percentStakeFromSelection();

    const valorApostadoCalculado =
      percentStake > 0 ? (base * percentStake) / 100 : 0;
    setValorApostado(valorApostadoCalculado);

    // Pendente: não calcula lucro/prejuízo
    if (resultado === "pendente") {
      setValorResultado(0);
      return;
    }

    // Calcula resultado se tiver odd e resultado selecionado
    if (odd && valorApostadoCalculado > 0) {
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
      return stakeCustomizada.trim()
        ? `${stakeCustomizada} un`
        : "Outra unidade (customizada)";
    }
    if (stakeSelecionada.startsWith("ps:")) {
      const id = stakeSelecionada.slice(3);
      const found = stakesPersonalizadas.find((s) => s.id === id);
      return found ? `${found.percent} un` : "Unidade personalizada";
    }
    return `${stakeSelecionada} un`;
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
        alert("Por favor, selecione uma unidade");
        setLoading(false);
        return;
      }

      if (!odd || odd === "") {
        alert("Por favor, insira a odd");
        setLoading(false);
        return;
      }

      // resultado sempre existe (padrão: pendente)

      const percentStake = percentStakeFromSelection();
      if (!percentStake || percentStake <= 0) {
        alert(
          stakeSelecionada === "custom"
            ? "Por favor, insira um valor válido para a unidade customizada"
            : "Por favor, selecione uma unidade válida"
        );
        setLoading(false);
        return;
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
      const observacoesFinal = descricao.trim() ? descricao.trim() : null;
      const valorResultadoFinal = resultado === "pendente" ? null : valorResultado;

      // Salva a entrada no banco de dados (retorna a linha inserida para garantir persistência do mercado)
      const { data: insertedRow, error: insertError } = await supabase
        .from("entradas")
        .insert({
        user_id: user.id,
        stake_percent: percentStake,
        valor_stake: valorApostado,
        odd: oddValue,
        esporte: esporteFinal,
        mercado: mercadoFinal,
        observacoes: observacoesFinal,
          resultado: resultado,
          valor_resultado: valorResultadoFinal,
        })
        .select("id, mercado")
        .single();

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
        } else if (
          (insertError.message.includes("observacoes") && insertError.message.includes("column")) ||
          insertError.message.includes("observacoes does not exist")
        ) {
          alert(
            `❌ Coluna 'observacoes' não encontrada na tabela 'entradas'!\n\n` +
              `📋 Para resolver:\n` +
              `1. Acesse: https://supabase.com/dashboard\n` +
              `2. Vá em "SQL Editor"\n` +
              `3. Execute a migration "0013_add_observacoes_to_entradas.sql" (pasta supabase/migrations)\n\n` +
              `Isso adiciona a coluna 'observacoes' para salvar descrições.`
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

      // Track analytics
      trackEntradaRegistered({ esporte: esporteFinal, mercado: mercadoFinal, resultado });

      // Salva sugestão de mercado por esporte (best-effort)
      if (mercadoFinal) {
        try {
          const { error: sugestaoError } = await supabase
            .from("mercados_sugeridos")
            .upsert(
              { user_id: user.id, esporte: esporteFinal, mercado: mercadoFinal },
              { onConflict: "user_id,esporte,mercado", ignoreDuplicates: true }
            );
          if (sugestaoError) {
            console.warn("Falha ao salvar sugestão de mercado:", sugestaoError);
          }
        } catch {
          // ignore
        }
      }

      // Calcula nova banca (banca atual + resultado da entrada)
      const bancaNova = (bancaAtual || 0) + (valorResultadoFinal || 0);

      // Atualiza o estado da banca atual
      setBancaAtual(bancaNova);

      // Limpa o formulário
      setStakeSelecionada("");
      setStakeCustomizada("");
      setOdd("");
      setEsporte("");
      setEsporteCustomizado("");
      setMercadoTexto("");
      setDescricao("");
      setSugestoesMercado([]);
      setResultado("pendente");
      setValorApostado(0);
      setValorResultado(0);

      // Mostra toast de sucesso
      setToast({ show: true, bancaNova });

      // Auto-hide após 5 segundos
      setTimeout(() => {
        setToast(null);
      }, 5000);
    } catch (error) {
      console.error("Erro ao registrar entrada:", error);
      alert("Erro ao registrar entrada");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Registrar Entradas</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>
            Registre uma nova entrada com unidades, odd e resultado
          </p>
        </div>
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
            <div
              className={`mb-6 rounded-2xl border p-5 ${
                theme === "dark"
                  ? "bg-amber-900/20 border-amber-700/50"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  theme === "dark" ? "bg-amber-800/50" : "bg-amber-100"
                }`}>
                  <svg className={`w-5 h-5 ${theme === "dark" ? "text-amber-300" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${theme === "dark" ? "text-amber-200" : "text-amber-900"}`}>
                    Configure sua banca primeiro
                  </h3>
                  <p className={`mt-1 text-sm ${theme === "dark" ? "text-amber-300/80" : "text-amber-800"}`}>
                    Para registrar entradas, você precisa definir o valor da sua banca inicial. Isso permite calcular automaticamente o valor das suas apostas baseado em unidades.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/banca")}
                    className={`mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      theme === "dark"
                        ? "bg-amber-600 text-white hover:bg-amber-500"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    }`}
                  >
                    Registrar banca
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Unidade */}
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
                    Selecionar unidade
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
                      {stake} un{" "}
                      {bancaInicial && bancaInicial > 0
                        ? `(R$ ${((bancaInicial * stake) / 100).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })})`
                        : ""}
                        </div>
                      </div>
                    </label>
                  ))}

                  {stakesPersonalizadas.length > 0 && (
                    <div className={`pt-2 mt-2 border-t ${cardBorder}`}>
                      <div className={`text-xs font-semibold ${textTertiary} mb-2`}>
                        Unidades personalizadas
                      </div>
                      <div className="space-y-2">
                        {stakesPersonalizadas.map((s) => {
                          const base = (stakeBase ?? bancaInicial) ?? 0;
                          const valor =
                            base > 0 ? (base * Number(s.percent)) / 100 : 0;
                          const value = `ps:${s.id}`;
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center p-3 rounded-lg border ${cardBorder} cursor-pointer ${hoverBg} transition-colors`}
                            >
                              <input
                                type="radio"
                                name="stake"
                                value={value}
                                checked={stakeSelecionada === value}
                                onChange={(e) => {
                                  handleStakeChange(e.target.value);
                                  setMostrarStake(false);
                                }}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${textPrimary}`}>
                                  {s.percent} un{" "}
                                  {base > 0
                                    ? `(R$ ${valor.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })})`
                                    : ""}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                        Outra unidade (customizada)
                      </div>
                      {stakeSelecionada === "custom" && (
                        <div className="space-y-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Digite as unidades (ex: 1.5)"
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
              <div
                className={`p-4 rounded-lg border ${
                  theme === "dark"
                    ? "bg-blue-900/20 border-blue-800"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="text-xs mb-1 text-blue-600 dark:text-blue-200">
                  Valor Apostado
                </div>
                <div className="text-xl font-semibold text-blue-700 dark:text-blue-100">
                  R$ {valorApostado.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-xs mt-1 text-blue-500 dark:text-blue-200/80">
                  Calculado automaticamente baseado na banca e unidades
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
                className={`w-full p-3 rounded-lg border bg-white text-zinc-900 placeholder-zinc-400 border-zinc-300 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
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
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className={`block text-sm font-medium ${textSecondary}`}>
                  Mercado Utilizado <span className={`${textTertiary}`}>(opcional)</span>
                </label>
              </div>

              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  placeholder={esporteFinalValue() ? "Ex: Ambas marcam, Handicap, Over 2.5..." : "Selecione um esporte primeiro"}
                  value={mercadoTexto}
                  onChange={(e) => setMercadoTexto(e.target.value)}
                  onBlur={() => {
                    // Salva como sugestão ao sair do campo (sem precisar registrar a entrada)
                    void saveMercadoSugestaoIfNeeded();
                  }}
                  disabled={!esporteFinalValue()}
                  list="mercado-sugestoes"
                  className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent disabled:opacity-60`}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!esporteFinalValue()) {
                      alert("Selecione um esporte antes de adicionar um mercado.");
                      return;
                    }
                    setNovoMercadoNome(mercadoTexto.trim());
                    setModalMercadoOpen(true);
                  }}
                  disabled={!esporteFinalValue()}
                  className={`w-11 rounded-lg border font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    theme === "dark"
                      ? "border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                      : "border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                  }`}
                  aria-label="Adicionar mercado"
                  title="Adicionar mercado"
                >
                  +
                </button>
              </div>
              <datalist id="mercado-sugestoes">
                {sugestoesMercado.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>

              {esporteFinalValue() && (
                <div className="mt-2">
                  <div className={`text-xs ${textTertiary}`}>
                    {loadingSugestoes ? "Carregando mercados..." : sugestoesMercado.length > 0 ? "Mercados salvos" : "Sem mercados salvos ainda — ao registrar, salvamos como mercado."}
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

            {/* Descrição (opcional) */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                Descrição <span className={`${textTertiary}`}>(opcional)</span>
              </label>
              <textarea
                placeholder="Ex: Motivo da entrada, leitura do jogo, plano de gestão..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
              />
              <p className={`text-xs ${textTertiary} mt-2`}>
                Use para registrar a lógica da aposta e facilitar revisões depois.
              </p>
            </div>

            {/* Resultado (Green/Red) */}
            <div>
              <label className={`block text-sm font-medium ${textSecondary} mb-3`}>
                Resultado
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label
                  className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors ${
                    resultado === "pendente"
                      ? "bg-zinc-600 border-zinc-600 hover:bg-zinc-700"
                      : theme === "dark"
                      ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                      : "bg-white border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value="pendente"
                    checked={resultado === "pendente"}
                    onChange={(e) => setResultado(e.target.value as "pendente")}
                    className="mr-2"
                  />
                  <span
                    className={`font-semibold ${
                      resultado === "pendente" ? "text-white" : textPrimary
                    }`}
                  >
                    Pendente
                  </span>
                </label>

                <label
                  className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors ${
                    resultado === "green"
                      ? "bg-green-600 border-green-600 hover:bg-green-700"
                      : theme === "dark"
                      ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                      : "bg-white border-zinc-300 hover:bg-zinc-50"
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
                      resultado === "green" ? "text-white" : textPrimary
                    }`}
                  >
                    Green
                  </span>
                </label>

                <label
                  className={`flex items-center justify-center p-4 rounded-lg border cursor-pointer transition-colors ${
                    resultado === "red"
                      ? "bg-red-600 border-red-600 hover:bg-red-700"
                      : theme === "dark"
                      ? "bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                      : "bg-white border-zinc-300 hover:bg-zinc-50"
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
                      resultado === "red" ? "text-white" : textPrimary
                    }`}
                  >
                    Red
                  </span>
                </label>
              </div>
            </div>

            {/* Valor Resultado (calculado automaticamente) */}
            {resultado !== "pendente" && valorApostado > 0 && odd && (
              <div
                className={`p-4 rounded-lg border ${
                  valorResultado >= 0
                    ? theme === "dark"
                      ? "bg-green-900/20 border-green-800"
                      : "bg-green-50 border-green-200"
                    : theme === "dark"
                    ? "bg-red-900/20 border-red-800"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div
                  className={`text-xs mb-1 ${
                    valorResultado >= 0
                      ? "text-green-600 dark:text-green-200"
                      : "text-red-600 dark:text-red-200"
                  }`}
                >
                  Resultado Calculado
                </div>
                <div
                  className={`text-xl font-semibold ${
                    valorResultado >= 0
                      ? "text-green-700 dark:text-green-100"
                      : "text-red-700 dark:text-red-100"
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
                    valorResultado >= 0
                      ? "text-green-500 dark:text-green-200/80"
                      : "text-red-500 dark:text-red-200/80"
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

      {/* Toast de sucesso */}
      {toast?.show && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          style={{
            animation: "slideUp 0.3s ease-out"
          }}
        >
          <style>{`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }
          `}</style>
          <div
            className={`rounded-2xl border shadow-lg p-4 ${
              theme === "dark"
                ? "bg-zinc-900 border-zinc-700"
                : "bg-white border-zinc-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${textPrimary}`}>
                  Entrada registrada!
                </p>
                <p className={`text-sm mt-1 ${textSecondary}`}>
                  Sua banca atual agora é:
                </p>
                <p className={`text-lg font-bold mt-1 ${
                  theme === "dark" ? "text-green-400" : "text-green-600"
                }`}>
                  R$ {toast.bancaNova.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className={`flex-shrink-0 p-1 rounded-lg transition-colors cursor-pointer ${
                  theme === "dark"
                    ? "hover:bg-zinc-800 text-zinc-400"
                    : "hover:bg-zinc-100 text-zinc-500"
                }`}
                aria-label="Fechar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMercadoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => {
              if (!savingMercado) {
                setModalMercadoOpen(false);
                setNovoMercadoNome("");
              }
            }}
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar modal"
          />

          <div
            className={`relative w-full max-w-lg rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-xl`}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-4">
              <h3 className={`text-lg font-semibold ${textPrimary}`}>Adicionar Mercado</h3>
              <p className={`mt-1 text-sm ${textSecondary}`}>
                Salva este mercado vinculado ao esporte selecionado para aparecer nas sugestões.
              </p>
            </div>

            <div className="space-y-2">
              <label className={`block text-sm font-medium ${textSecondary}`}>
                Nome do mercado
              </label>
              <input
                type="text"
                value={novoMercadoNome}
                onChange={(e) => setNovoMercadoNome(e.target.value)}
                placeholder="Ex: Handicap, Cantos, Over 2.5..."
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
                autoFocus
              />
              <p className={`text-xs ${textTertiary}`}>
                Duplicados são ignorados automaticamente (por esporte).
              </p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!savingMercado) {
                    setModalMercadoOpen(false);
                    setNovoMercadoNome("");
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAddMercado()}
                disabled={savingMercado || !novoMercadoNome.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-700 text-white hover:bg-zinc-600"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                {savingMercado ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
