"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function OnboardingBancaPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-50";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";

  useEffect(() => {
    async function checkStatus() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: banca } = await supabase
          .from("banca")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (banca) {
          router.replace("/onboarding/entrada");
          return;
        }

        setChecking(false);
      } catch (err) {
        console.error("Erro no checkStatus:", err);
        setChecking(false);
      }
    }

    checkStatus();
  }, [router]);

  function formatCurrency(value: string): string {
    const numbers = value.replace(/\D/g, "");
    const amount = parseInt(numbers || "0", 10) / 100;
    return amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function handleValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCurrency(e.target.value);
    setValor(formatted);
  }

  function parseValue(value: string): number {
    return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valorNumerico = parseValue(valor);

    if (valorNumerico <= 0) {
      alert("Por favor, insira um valor válido para sua banca.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase.from("banca").insert({
        user_id: user.id,
        valor: valorNumerico,
        stake_base: valorNumerico,
      });

      if (error) {
        console.error("Erro ao criar banca:", error);
        alert("Erro ao criar banca. Tente novamente.");
        return;
      }

      router.push("/onboarding/entrada");
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao criar banca. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div
          className={`w-8 h-8 border-2 rounded-full animate-spin ${
            theme === "dark"
              ? "border-zinc-700 border-t-white"
              : "border-zinc-200 border-t-zinc-900"
          }`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            theme === "dark" ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
          }`}>
            1
          </div>
          <span className={`mt-2 text-xs font-medium ${textPrimary}`}>Banca</span>
        </div>
        <div className={`w-12 h-0.5 ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            theme === "dark" ? "bg-zinc-800 text-zinc-500" : "bg-zinc-200 text-zinc-400"
          }`}>
            2
          </div>
          <span className={`mt-2 text-xs font-medium ${theme === "dark" ? "text-zinc-600" : "text-zinc-400"}`}>Entrada</span>
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
        <div className="text-center mb-8">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            theme === "dark" ? "bg-emerald-500/20" : "bg-emerald-100"
          }`}>
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className={`text-2xl font-bold ${textPrimary}`}>Defina sua banca</h1>
          <p className={`mt-2 text-sm ${textSecondary}`}>
            Qual é o valor total que você tem disponível para suas apostas?
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className={`block text-sm font-medium ${textSecondary} mb-2`}>
              Valor da banca inicial
            </label>
            <div className="relative">
              <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium ${textSecondary}`}>
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={valor}
                onChange={handleValueChange}
                placeholder="0,00"
                className={`w-full pl-12 pr-4 py-4 rounded-xl border text-xl font-semibold ${inputBg} ${inputBorder} ${textPrimary} placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all`}
                autoFocus
              />
            </div>
            <p className={`mt-2 text-xs ${textSecondary}`}>
              Este valor será usado para calcular suas unidades de aposta.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || parseValue(valor) <= 0}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Criando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continuar
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>
        </form>
      </div>

      <p className={`text-center text-xs ${textSecondary}`}>
        Você poderá ajustar este valor depois nas configurações.
      </p>
    </div>
  );
}
