"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type StakePersonalizada = {
  id: string;
  nome: string;
  percent: number;
};

export default function BancaPage() {
  const { theme } = useTheme();
  const [bancaInicial, setBancaInicial] = useState<number | null>(null);
  const [bancaAtual, setBancaAtual] = useState<number | null>(null);
  const [stakeBase, setStakeBase] = useState<number | null>(null);
  const [bancaFormatada, setBancaFormatada] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reajustando, setReajustando] = useState(false);
  const [stakesPersonalizadas, setStakesPersonalizadas] = useState<StakePersonalizada[]>([]);
  const [stakesPersonalizadasMissing, setStakesPersonalizadasMissing] = useState(false);
  const [modalStakeOpen, setModalStakeOpen] = useState(false);
  const [stakeNome] = useState("stake");
  const [stakePercentInput, setStakePercentInput] = useState<string>("");
  const [savingStake, setSavingStake] = useState(false);

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  // Stakes pré-definidas
  const stakes = [0.2, 0.5, 1, 2, 5];

  // Função para formatar como moeda brasileira
  function formatCurrency(value: string): string {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");
    
    if (!numbers) return "";

    // Converte para número e divide por 100 para ter centavos
    const number = parseFloat(numbers) / 100;

    // Formata como moeda brasileira
    return number.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Função para converter valor formatado de volta para número
  function parseCurrency(value: string): number {
    const numbers = value.replace(/\D/g, "");
    if (!numbers) return 0;
    return parseFloat(numbers) / 100;
  }

  useEffect(() => {
    loadBanca();
    loadStakesPersonalizadas();
  }, []);

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
        const msg = String(error?.message || "").toLowerCase();
        const missing =
          msg.includes("relation") ||
          msg.includes("does not exist") ||
          msg.includes("could not find the table") ||
          msg.includes("stakes_personalizadas");
        if (missing) {
          setStakesPersonalizadasMissing(true);
          setStakesPersonalizadas([]);
          return;
        }
        // best-effort: não quebra a tela
        setStakesPersonalizadas([]);
        return;
      }

      setStakesPersonalizadasMissing(false);
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

  async function handleCreateStakePersonalizada() {
    setSavingStake(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Usuário não autenticado");
        return;
      }

      const percent = parseFloat(stakePercentInput.replace(",", "."));
      if (isNaN(percent) || percent <= 0 || percent > 100) {
        alert("Informe um percentual válido (entre 0 e 100).");
        return;
      }

      const { error } = await supabase
        .from("stakes_personalizadas")
        .upsert(
          {
            user_id: user.id,
            nome: stakeNome,
            percent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,percent" }
        );

      if (error) {
        const msg = String(error?.message || "");
        if (
          msg.includes("Could not find the table") ||
          msg.includes("relation") ||
          msg.includes("does not exist")
        ) {
          setStakesPersonalizadasMissing(true);
          alert(
            `❌ Tabela 'stakes_personalizadas' não encontrada!\n\n` +
              `📋 Para resolver:\n` +
              `1. Acesse o Supabase (SQL Editor)\n` +
              `2. Execute a migration "0012_stakes_personalizadas.sql" (pasta supabase/migrations)\n\n` +
              `Isso cria a tabela e as policies.`
          );
          return;
        }
        alert(`Erro ao salvar unidade personalizada: ${error.message}`);
        return;
      }

      await loadStakesPersonalizadas();
      setModalStakeOpen(false);
      setStakePercentInput("");
      alert("✅ Unidade personalizada salva com sucesso!");
    } finally {
      setSavingStake(false);
    }
  }

  async function loadBanca() {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
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
        setLoading(false);
        return;
      }

      const bancaInicialValue = bancaData?.valor || 0;
      const stakeBaseValue =
        bancaData?.stake_base !== null && bancaData?.stake_base !== undefined
          ? Number(bancaData.stake_base)
          : bancaInicialValue;
      setBancaInicial(bancaInicialValue);
      setStakeBase(stakeBaseValue);

      // Busca entradas para calcular banca atual
      const { data: entradasData, error: entradasError } = await supabase
        .from("entradas")
        .select("valor_resultado")
        .eq("user_id", user.id);

      if (entradasError) {
        console.error("Erro ao carregar entradas:", entradasError);
        setBancaAtual(bancaInicialValue);
        setLoading(false);
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

      // Formata o valor da banca inicial para o campo de input
      if (bancaInicialValue > 0) {
        setBancaFormatada(
          bancaInicialValue.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
    } catch (error) {
      console.error("Erro ao carregar banca:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBanca(e: React.FormEvent) {
    e.preventDefault();
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

      // Converte o valor formatado para número
      const valorBanca = parseCurrency(bancaFormatada);

      if (isNaN(valorBanca) || valorBanca <= 0) {
        alert("Por favor, insira um valor válido para a banca (ex: R$ 5.000,00)");
        setSaving(false);
        return;
      }

      // Verifica se já existe uma banca
      const { data: existingBanca } = await supabase
        .from("banca")
        .select("id, valor")
        .eq("user_id", user.id)
        .single();

      let error;

      if (existingBanca) {
        // Se já existe uma banca inicial registrada, NÃO sobrescreve o valor inicial.
        // A partir daqui, o input serve para ajustar a base de stake (stake_base).
        const hasInitialLocked =
          existingBanca?.valor !== null &&
          existingBanca?.valor !== undefined &&
          Number(existingBanca.valor) > 0;

        const payload: any = hasInitialLocked
          ? {
              stake_base: valorBanca,
              updated_at: new Date().toISOString(),
            }
          : {
              valor: valorBanca,
              stake_base: valorBanca,
              updated_at: new Date().toISOString(),
            };

        let { error: updateError } = await supabase
          .from("banca")
          .update(payload)
          .eq("user_id", user.id);

        const stakeBaseMissing =
          !!updateError &&
          typeof updateError?.message === "string" &&
          updateError.message.toLowerCase().includes("stake_base");

        if (stakeBaseMissing) {
          const payloadFallback: any = {
            valor: valorBanca,
            updated_at: new Date().toISOString(),
          };
          ({ error: updateError } = await supabase
            .from("banca")
            .update(payloadFallback)
            .eq("user_id", user.id));
        }

        error = updateError;
      } else {
        // Insere nova banca (fallback se stake_base não existir ainda)
        let { error: insertError } = await supabase.from("banca").insert({
          user_id: user.id,
          valor: valorBanca,
          stake_base: valorBanca,
        });

        const stakeBaseMissing =
          !!insertError &&
          typeof insertError?.message === "string" &&
          insertError.message.toLowerCase().includes("stake_base");

        if (stakeBaseMissing) {
          ({ error: insertError } = await supabase.from("banca").insert({
            user_id: user.id,
            valor: valorBanca,
          }));
        }

        error = insertError;
      }

      if (error) {
        console.error("Erro ao salvar banca:", error);
        alert(
          `Erro ao salvar banca: ${error.message}\n\n` +
          `Verifique se a tabela 'banca' existe e tem a coluna 'valor'.`
        );
      } else {
        // Recarrega os dados
        await loadBanca();
        const isFirst = !existingBanca || !(Number(existingBanca?.valor || 0) > 0);
        alert(
          isFirst
            ? `✅ Banca inicial salva com sucesso!\n\nValor: R$ ${valorBanca.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : `✅ Base de unidade salva com sucesso!\n\nValor: R$ ${valorBanca.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}\n\nA banca inicial permanece a primeira banca definida.`
        );
      }
    } catch (error: any) {
      console.error("Erro ao salvar banca:", error);
      alert("Erro ao salvar banca");
    } finally {
      setSaving(false);
    }
  }

  async function handleReajustarStake() {
    if (bancaAtual === null || bancaAtual <= 0) {
      alert("Não há banca atual para reajustar");
      return;
    }

    if (
      !confirm(
        `Tem certeza que deseja reajustar a base de unidade para R$ ${bancaAtual.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}?\n\n` +
        `Isso fará com que as unidades sejam recalculadas com base na nova base de unidade (a banca inicial não muda).`
      )
    ) {
      return;
    }

    setReajustando(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Usuário não autenticado");
        setReajustando(false);
        return;
      }

      // Atualiza SOMENTE a base de stake (se a coluna existir)
      const { error } = await supabase
        .from("banca")
        .update({
          stake_base: bancaAtual,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        const stakeBaseMissing =
          typeof error?.message === "string" &&
          error.message.toLowerCase().includes("stake_base");

        if (stakeBaseMissing) {
          alert(
            "Para usar o reajuste de unidade, aplique a migration `0010_add_stake_base_to_banca.sql` no Supabase (coluna stake_base)."
          );
        } else {
          console.error("Erro ao reajustar stake:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          alert(`Erro ao reajustar unidade: ${error.message}`);
        }
      } else {
        // Recarrega os dados
        await loadBanca();
        alert(
          `✅ Base de unidade reajustada com sucesso!\n\n` +
          `Nova base de unidade: R$ ${bancaAtual.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n\n` +
          `As unidades serão calculadas com base neste novo valor (a banca inicial permanece a mesma).`
        );
      }
    } catch (error: any) {
      console.error("Erro ao reajustar banca:", error);
      alert("Erro ao reajustar banca");
    } finally {
      setReajustando(false);
    }
  }

  function calculateStake(percent: number): number {
    if (stakeBase === null || stakeBase <= 0) return 0;
    return (stakeBase * percent) / 100;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Banca</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Banca</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Defina o valor da banca inicial para calcular as unidades automaticamente
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Formulário para definir banca */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Definir Banca Inicial
          </h2>

          {/* Banca Inicial */}
          {bancaInicial !== null && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              theme === "dark" 
                ? "bg-blue-900/20 border-blue-800" 
                : "bg-blue-50 border-blue-500"
            }`}>
              <div className={`text-xs font-semibold mb-1 ${
                theme === "dark" ? "text-blue-400" : "text-blue-700"
              }`}>
                Banca Inicial
              </div>
              <div className={`text-2xl font-bold ${
                theme === "dark" ? "text-blue-300" : "text-blue-900"
              }`}>
                R$ {bancaInicial.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className={`text-xs mt-1 ${
                theme === "dark" ? "text-blue-400" : "text-blue-600"
              }`}>
                Primeira banca definida pelo lead
              </div>
            </div>
          )}

          {/* Base de Unidade */}
          {stakeBase !== null && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              theme === "dark"
                ? "bg-zinc-800 border-zinc-700"
                : "bg-zinc-50 border-zinc-300"
            }`}>
              <div className={`text-xs font-semibold mb-1 ${textSecondary}`}>
                Base de Unidade
              </div>
              <div className={`text-2xl font-bold ${textPrimary}`}>
                R$ {stakeBase.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className={`text-xs mt-1 ${textTertiary}`}>
                Valor usado para calcular as unidades (pode ser reajustado)
              </div>
            </div>
          )}

          {/* Banca Atual */}
          {bancaAtual !== null && (
            <div className={`mb-4 p-4 rounded-lg border-2 ${
              theme === "dark" 
                ? "bg-green-900/20 border-green-800" 
                : "bg-green-50 border-green-500"
            }`}>
              <div className={`text-xs font-semibold mb-1 ${
                theme === "dark" ? "text-green-400" : "text-green-700"
              }`}>
                Banca Atual
              </div>
              <div className={`text-2xl font-bold ${
                theme === "dark" ? "text-green-300" : "text-green-900"
              }`}>
                R$ {bancaAtual.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className={`text-xs mt-1 ${
                theme === "dark" ? "text-green-400" : "text-green-600"
              }`}>
                Banca inicial + resultados das entradas
              </div>
            </div>
          )}

          <form onSubmit={handleSaveBanca} className="space-y-4">
            <div>
              <label
                htmlFor="banca"
                className={`block text-sm font-medium ${textSecondary} mb-2`}
              >
                Valor da Banca Inicial (R$)
              </label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${textTertiary} font-medium`}>
                  R$
                </span>
                <input
                  type="text"
                  id="banca"
                  name="banca"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={bancaFormatada}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Remove R$ e espaços
                    const cleanValue = rawValue.replace(/R\$\s*/g, "").trim();
                    
                    // Formata como moeda
                    const formatted = formatCurrency(cleanValue);
                    setBancaFormatada(formatted);
                  }}
                  onBlur={() => {
                    // Garante formatação ao sair do campo
                    if (bancaInicial !== null && bancaInicial > 0) {
                      setBancaFormatada(
                        bancaInicial.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      );
                    }
                  }}
                  className={`w-full pl-10 pr-3 py-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
                  required
                />
              </div>
              <p className={`text-xs ${textTertiary} mt-1`}>
                Digite o valor (ex: 5000 para R$ 5.000,00)
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`w-full p-3 rounded-lg font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                theme === "dark"
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              {saving ? "Salvando..." : "Salvar Banca Inicial"}
            </button>
          </form>

          {/* Botão para reajustar unidade */}
          {bancaAtual !== null && bancaInicial !== null && bancaAtual !== bancaInicial && (
            <div className={`mt-4 pt-4 border-t ${cardBorder}`}>
              <button
                onClick={handleReajustarStake}
                disabled={reajustando}
                className="w-full p-3 rounded-lg bg-green-600 text-white font-semibold cursor-pointer hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {reajustando
                  ? "Reajustando..."
                  : "Reajustar Unidade para Banca Atual"}
              </button>
              <p className={`text-xs ${textTertiary} mt-2 text-center`}>
                Atualiza apenas a base de unidade para o valor atual ({bancaAtual.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })})
              </p>
            </div>
          )}
        </div>

        {/* Visualização das Stakes */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Unidades Calculadas</h2>
            <button
              type="button"
              onClick={() => setModalStakeOpen(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
                theme === "dark"
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              Criar unidade personalizada
            </button>
          </div>
          <p className={`text-xs ${textTertiary} mb-4`}>
            Valores calculados automaticamente baseados na <strong>base de unidade</strong> (apenas para visualização)
          </p>

          <div className="space-y-3">
            {stakes.map((stake) => {
              const valor = calculateStake(stake);
              return (
                <div
                  key={stake}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
                  } border ${cardBorder}`}
                >
                  <div>
                    <div className={`text-sm font-medium ${textSecondary}`}>
                      {stake} un
                    </div>
                    <div className={`text-xs ${textTertiary}`}>Unidade</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${textPrimary}`}>
                      R$ {valor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!stakesPersonalizadasMissing && stakesPersonalizadas.length > 0 && (
            <div className={`mt-6 pt-6 border-t ${cardBorder}`}>
              <div className="space-y-3">
                {stakesPersonalizadas.map((s) => {
                  const valor = calculateStake(s.percent);
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
                      } border ${cardBorder}`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${textSecondary}`}>
                          {s.percent} un
                        </div>
                        <div className={`text-xs ${textTertiary}`}>{s.nome}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${textPrimary}`}>
                          R$ {valor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(!bancaInicial || bancaInicial <= 0) && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                theme === "dark"
                  ? "bg-amber-900/20 border-amber-800 text-amber-200"
                  : "bg-amber-50 border-amber-300 text-amber-950"
              }`}
            >
              Defina sua banca inicial para ver as unidades calculadas.
            </div>
          )}
        </div>
      </div>

      {modalStakeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => {
              if (!savingStake) {
                setModalStakeOpen(false);
                setStakePercentInput("");
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
              <h3 className={`text-lg font-semibold ${textPrimary}`}>
                Criar unidade personalizada
              </h3>
              <p className={`mt-1 text-sm ${textSecondary}`}>
                Defina uma unidade em % da sua banca (base de unidade).
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Nome
                </label>
                <input
                  value={stakeNome}
                  disabled
                  className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} opacity-70`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
                  Valor da unidade (% da banca)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 1.5"
                  value={stakePercentInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d,.-]/g, "");
                    setStakePercentInput(value);
                  }}
                  className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
                />
                <p className={`text-xs ${textTertiary} mt-2`}>
                  Exemplo: 1 significa 1% da base de unidade.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!savingStake) {
                    setModalStakeOpen(false);
                    setStakePercentInput("");
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
                onClick={handleCreateStakePersonalizada}
                disabled={savingStake}
                className={`px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-700 text-white hover:bg-zinc-600"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                {savingStake ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}