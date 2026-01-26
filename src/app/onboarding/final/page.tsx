"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function OnboardingFinalPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  useEffect(() => {
    async function checkStatus() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const [bancaRes, entradaRes] = await Promise.all([
          supabase.from("banca").select("id").eq("user_id", user.id).single(),
          supabase.from("entradas").select("id").eq("user_id", user.id).limit(1).single(),
        ]);

        if (!bancaRes.data) {
          router.replace("/onboarding/banca");
          return;
        }

        if (!entradaRes.data) {
          router.replace("/onboarding/entrada");
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

  async function handleComplete() {
    setLoading(true);

    try {
      await supabase.rpc("complete_onboarding");
      router.push("/dashboard");
    } catch (error) {
      console.error("Erro:", error);
      router.push("/dashboard");
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
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-emerald-500 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className={`mt-2 text-xs font-medium ${textPrimary}`}>Entrada</span>
        </div>
        <div className="w-12 h-0.5 bg-emerald-500" />
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            theme === "dark" ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
          }`}>
            3
          </div>
          <span className={`mt-2 text-xs font-medium ${textPrimary}`}>Pronto</span>
        </div>
      </div>

      {/* Card */}
      <div className={`rounded-3xl border ${cardBorder} ${cardBg} p-8 shadow-xl text-center`}>
        <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-emerald-500/20">
          <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className={`text-2xl font-bold ${textPrimary}`}>Tudo pronto!</h1>
        <p className={`mt-3 ${textSecondary}`}>
          Sua banca está configurada e sua primeira entrada foi registrada.
        </p>
        <p className={`mt-2 text-sm ${textSecondary}`}>
          Agora você pode explorar todas as funcionalidades do ProStake.
        </p>

        <div className="mt-8">
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-white transition-all disabled:opacity-50 bg-emerald-600 hover:bg-emerald-500"
          >
            {loading ? "Carregando..." : "Acessar o Painel"}
          </button>
        </div>

        <p className={`mt-6 text-xs ${textSecondary} border-t ${cardBorder} pt-6`}>
          Dica: Use as Sugestões da IA para descobrir oportunidades de apostas.
        </p>
      </div>
    </div>
  );
}
