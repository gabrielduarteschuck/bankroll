"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

const STAKES = [0.5, 1, 2, 3, 5];
const ESPORTES = ["Futebol", "Basquete (NBA)", "Tênis", "Vôlei", "MMA", "Outro"];

export default function OnboardingEntradaPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [bancaValor, setBancaValor] = useState(0);

  const [stake, setStake] = useState<number | null>(null);
  const [odd, setOdd] = useState("");
  const [esporte, setEsporte] = useState("");
  const [resultado, setResultado] = useState<"pendente" | "green" | "red">("pendente");

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-50";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";

  useEffect(() => {
    async function checkStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: banca } = await supabase
          .from("banca")
          .select("valor")
          .eq("user_id", user.id)
          .single();

        if (!banca) {
          router.replace("/onboarding/banca");
          return;
        }

        setBancaValor(banca.valor);

        const { data: entrada } = await supabase
          .from("entradas")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (entrada) {
          router.replace("/onboarding/final");
          return;
        }

        setChecking(false);
      } catch (err) {
        console.error("Erro:", err);
        setChecking(false);
      }
    }

    checkStatus();
  }, [router]);

  function calcularValorAposta(): number {
    if (!stake || !bancaValor) return 0;
    return (bancaValor * stake) / 100;
  }

  function calcularResultado(): number {
    const valorAposta = calcularValorAposta();
    const oddValue = parseFloat(odd.replace(",", ".")) || 0;

    if (resultado === "pendente") return 0;
    if (resultado === "green") return valorAposta * oddValue - valorAposta;
    return -valorAposta;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stake || !odd || !esporte) {
      alert("Preencha todos os campos.");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const valorAposta = calcularValorAposta();
      const valorResultado = resultado === "pendente" ? null : calcularResultado();
      const oddValue = parseFloat(odd.replace(",", "."));

      const { error } = await supabase.from("entradas").insert({
        user_id: user.id,
        stake_percent: stake,
        valor_stake: valorAposta,
        odd: oddValue,
        esporte: esporte,
        resultado: resultado,
        valor_resultado: valorResultado,
      });

      if (error) {
        console.error("Erro ao criar entrada:", error);
        alert("Erro ao registrar entrada. Tente novamente.");
        return;
      }

      router.push("/onboarding/final");
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao registrar entrada. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
          theme === "dark" ? "border-zinc-700 border-t-white" : "border-zinc-200 border-t-zinc-900"
        }`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-emerald-500 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className={`mt-2 text-xs font-medium ${textPrimary}`}>Banca</span>
        </div>
        <div className="w-12 h-0.5 bg-emerald-500" />
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            theme === "dark" ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
          }`}>
            2
          </div>
          <span className={`mt-2 text-xs font-medium ${textPrimary}`}>Entrada</span>
        </div>
        <div className={`w-12 h-0.5 ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            theme === "dark" ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400"
          }`}>
            3
          </div>
          <span className={`mt-2 text-xs font-medium ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`}>Pronto</span>
        </div>
      </div>

      {/* Card */}
      <div className={`rounded-3xl border ${cardBorder} ${cardBg} p-8 shadow-xl`}>
        <div className="text-center mb-6">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            theme === "dark" ? "bg-blue-500/20" : "bg-blue-100"
          }`}>
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h1 className={`text-2xl font-bold ${textPrimary}`}>Registre sua primeira entrada</h1>
          <p className={`mt-2 text-sm ${textSecondary}`}>Vamos praticar? Registre uma aposta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Unidade */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Unidade</label>
            <div className="grid grid-cols-5 gap-2">
              {STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStake(s)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    stake === s
                      ? "bg-blue-500 text-white"
                      : `${inputBg} ${textPrimary} border ${inputBorder}`
                  }`}
                >
                  {s}un
                </button>
              ))}
            </div>
            {stake && bancaValor > 0 && (
              <p className={`mt-2 text-xs ${textSecondary}`}>
                = R$ {calcularValorAposta().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          {/* Odd */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Odd</label>
            <input
              type="text"
              inputMode="decimal"
              value={odd}
              onChange={(e) => setOdd(e.target.value.replace(/[^\d,.-]/g, ""))}
              placeholder="Ex: 1.85"
              className={`w-full px-4 py-3 rounded-xl border ${inputBg} ${inputBorder} ${textPrimary} placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Esporte */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Esporte</label>
            <div className="grid grid-cols-3 gap-2">
              {ESPORTES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEsporte(e)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all ${
                    esporte === e
                      ? "bg-blue-500 text-white"
                      : `${inputBg} ${textPrimary} border ${inputBorder}`
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Resultado</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setResultado("pendente")}
                className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                  resultado === "pendente"
                    ? "bg-zinc-600 text-white"
                    : `${inputBg} ${textPrimary} border ${inputBorder}`
                }`}
              >
                Pendente
              </button>
              <button
                type="button"
                onClick={() => setResultado("green")}
                className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                  resultado === "green"
                    ? "bg-emerald-500 text-white"
                    : `${inputBg} ${textPrimary} border ${inputBorder}`
                }`}
              >
                Green
              </button>
              <button
                type="button"
                onClick={() => setResultado("red")}
                className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                  resultado === "red"
                    ? "bg-red-500 text-white"
                    : `${inputBg} ${textPrimary} border ${inputBorder}`
                }`}
              >
                Red
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !stake || !odd || !esporte}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500"
          >
            {loading ? "Registrando..." : "Registrar entrada"}
          </button>
        </form>
      </div>
    </div>
  );
}
