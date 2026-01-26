"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabaseClient";
import PremiumPaywall from "@/components/PremiumPaywall";

type Multipla = {
  id: string;
  titulo: string;
  descricao: string;
  odd_total: number;
  quantidade_jogos: number;
  image_url: string | null;
  link_bilhete: string | null;
  created_at: string;
};

export default function GeradorMultiplasPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  const [loading, setLoading] = useState(true);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [items, setItems] = useState<Multipla[]>([]);

  // Verificar se usuário é premium
  useEffect(() => {
    async function checkPremium() {
      try {
        const { data: paid } = await supabase.rpc("has_paid_access");
        setIsPremium(paid === true);
      } catch {
        setIsPremium(false);
      } finally {
        setCheckingPremium(false);
      }
    }
    checkPremium();
  }, []);

  useEffect(() => {
    if (!checkingPremium && isPremium) {
      void loadMultiplas();
    } else if (!checkingPremium && !isPremium) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingPremium, isPremium]);

  async function loadMultiplas() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("multiplas")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      setItems((data || []) as Multipla[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // Loading premium check
  if (checkingPremium) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
          theme === "dark" ? "border-zinc-700 border-t-white" : "border-zinc-200 border-t-zinc-900"
        }`} />
      </div>
    );
  }

  // Paywall para não-premium
  if (!isPremium) {
    return <PremiumPaywall feature="multiplas" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Gerador de Múltiplas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Múltiplas exclusivas selecionadas por especialistas para potencializar seus ganhos
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-64 rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-8 text-center`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Nenhuma múltipla disponível</h3>
          <p className={`mt-2 text-sm ${textSecondary}`}>
            Novas múltiplas serão publicadas em breve. Volte mais tarde!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {items.map((m) => (
            <div
              key={m.id}
              className={`group relative overflow-hidden rounded-3xl border shadow-sm transition-all ${
                theme === "dark"
                  ? "border-amber-500/20 bg-zinc-950 hover:border-amber-500/35 hover:shadow-lg hover:shadow-amber-500/10"
                  : "border-amber-200 bg-white hover:border-amber-300 hover:shadow-md"
              }`}
            >
              {/* Imagem da múltipla */}
              {m.image_url && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={m.image_url}
                    alt={m.titulo}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white`}>
                        {m.quantidade_jogos} jogos
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-white`}>
                        Odd {m.odd_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6">
                {!m.image_url && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      theme === "dark" ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-800"
                    }`}>
                      {m.quantidade_jogos} jogos
                    </span>
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      theme === "dark" ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      Odd {m.odd_total.toFixed(2)}
                    </span>
                  </div>
                )}

                <h3 className={`text-lg font-bold ${textPrimary}`}>{m.titulo}</h3>
                <p className={`mt-2 text-sm ${textSecondary} line-clamp-2`}>{m.descricao}</p>

                {m.link_bilhete && (
                  <a
                    href={m.link_bilhete}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-colors ${
                      theme === "dark"
                        ? "bg-amber-500 text-white hover:bg-amber-400"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    <span>Abrir Bilhete</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}

                <p className={`mt-3 text-xs text-center ${textSecondary}`}>
                  Publicado em {new Date(m.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
