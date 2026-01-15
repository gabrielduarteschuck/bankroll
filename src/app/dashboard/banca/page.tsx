"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function BancaPage() {
  const { theme } = useTheme();
  const [bancaInicial, setBancaInicial] = useState<number | null>(null);
  const [bancaAtual, setBancaAtual] = useState<number | null>(null);
  const [bancaFormatada, setBancaFormatada] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reajustando, setReajustando] = useState(false);

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
  }, []);

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

      // Busca a banca inicial do banco
      const { data: bancaData, error: bancaError } = await supabase
        .from("banca")
        .select("valor")
        .eq("user_id", user.id)
        .single();

      if (bancaError && bancaError.code !== "PGRST116") {
        console.error("Erro ao carregar banca:", bancaError);
        setLoading(false);
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
        .select("id")
        .eq("user_id", user.id)
        .single();

      let error;

      if (existingBanca) {
        // Atualiza banca existente
        const { error: updateError } = await supabase
          .from("banca")
          .update({
            valor: valorBanca,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        error = updateError;
      } else {
        // Insere nova banca
        const { error: insertError } = await supabase
          .from("banca")
          .insert({
            user_id: user.id,
            valor: valorBanca,
          });

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
        alert(`✅ Banca inicial salva com sucesso!\n\nValor: R$ ${valorBanca.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`);
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
        `Tem certeza que deseja reajustar a banca inicial para R$ ${bancaAtual.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}?\n\n` +
        `Isso fará com que as stakes sejam recalculadas com base na nova banca inicial.`
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

      // Atualiza a banca inicial para o valor da banca atual
      const { error } = await supabase
        .from("banca")
        .update({
          valor: bancaAtual,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao reajustar banca:", error);
        alert(`Erro ao reajustar banca: ${error.message}`);
      } else {
        // Recarrega os dados
        await loadBanca();
        alert(
          `✅ Banca inicial reajustada com sucesso!\n\n` +
          `Nova banca inicial: R$ ${bancaAtual.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n\n` +
          `As stakes serão calculadas com base neste novo valor.`
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
    if (bancaInicial === null || bancaInicial <= 0) return 0;
    return (bancaInicial * percent) / 100;
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
          Defina o valor da banca inicial para calcular as stakes automaticamente
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
                Base para cálculo das stakes
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

          {/* Botão para reajustar stake */}
          {bancaAtual !== null && bancaInicial !== null && bancaAtual !== bancaInicial && (
            <div className={`mt-4 pt-4 border-t ${cardBorder}`}>
              <button
                onClick={handleReajustarStake}
                disabled={reajustando}
                className="w-full p-3 rounded-lg bg-green-600 text-white font-semibold cursor-pointer hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {reajustando
                  ? "Reajustando..."
                  : "Reajustar Stake para Banca Atual"}
              </button>
              <p className={`text-xs ${textTertiary} mt-2 text-center`}>
                Atualiza a banca inicial para o valor atual ({bancaAtual.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })})
              </p>
            </div>
          )}
        </div>

        {/* Visualização das Stakes */}
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
            Stakes Calculadas
          </h2>
          <p className={`text-xs ${textTertiary} mb-4`}>
            Valores calculados automaticamente baseados na <strong>banca inicial</strong> (apenas para visualização)
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
                      {stake}%
                    </div>
                    <div className={`text-xs ${textTertiary}`}>Stake</div>
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

          {(!bancaInicial || bancaInicial <= 0) && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              Defina uma banca inicial para ver os valores calculados
            </div>
          )}
        </div>
      </div>
    </div>
  );
}