"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabaseClient";

interface PremiumPaywallProps {
  feature: "sugestoes" | "multiplas";
}

export default function PremiumPaywall({ feature }: PremiumPaywallProps) {
  const { theme } = useTheme();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function getEmail() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    }
    getEmail();
  }, []);

  const baseCheckoutUrl = process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL ||
    "https://buy.stripe.com/3cI5kC77baPigh99ToaMU01";

  // Adiciona o email do usuário como prefilled_email para garantir que o email bate
  const checkoutUrl = userEmail
    ? `${baseCheckoutUrl}?prefilled_email=${encodeURIComponent(userEmail)}`
    : baseCheckoutUrl;

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  const features = {
    sugestoes: {
      title: "Sugestões da IA",
      description: "Receba análises exclusivas geradas por inteligência artificial para maximizar seus resultados.",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      benefits: [
        "Análises diárias com odds acima de 1.50",
        "Nível de confiança em cada sugestão",
        "A IA busca sugestões em sites americanos de apostas (somente NBA)",
      ],
      theme: "amber",
    },
    multiplas: {
      title: "Gerador de Múltiplas",
      description: "Acesse múltiplas exclusivas criadas pela IA para potencializar seus ganhos.",
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      benefits: [
        "Múltiplas selecionadas pela IA DuarteAI",
        "Odds combinadas de alto valor",
        "Cotações geradas acima de 3.00 sem limite",
      ],
      theme: "green",
    },
  };

  const content = features[feature];
  const isGreen = content.theme === "green";

  // Classes dinâmicas baseadas no tema
  const headerGradient = isGreen
    ? "bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500"
    : "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500";

  const crownBg = isGreen ? "bg-emerald-300" : "bg-yellow-400";
  const crownText = isGreen ? "text-emerald-900" : "text-yellow-900";
  const pulseDot = isGreen ? "bg-emerald-300" : "bg-yellow-300";

  const ctaGradient = isGreen
    ? "bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600"
    : "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`max-w-lg w-full mx-4 rounded-3xl border ${cardBorder} ${cardBg} overflow-hidden shadow-2xl`}>
        {/* Header com gradiente */}
        <div className={`relative ${headerGradient} p-8 text-center`}>
          {/* Efeito de brilho */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          {/* Ícone com coroa */}
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm text-white mb-4">
              {content.icon}
            </div>
            <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full ${crownBg} flex items-center justify-center shadow-lg`}>
              <svg className={`w-5 h-5 ${crownText}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>
          </div>

          <h2 className="relative text-2xl font-bold text-white mb-2">{content.title}</h2>
          <div className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
            <span className={`w-2 h-2 rounded-full ${pulseDot} animate-pulse`} />
            <span className="text-sm font-medium text-white">Exclusivo Premium</span>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-8">
          <p className={`text-center ${textSecondary} mb-6`}>
            {content.description}
          </p>

          {/* Lista de benefícios */}
          <div className="space-y-3 mb-8">
            {content.benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className={`text-sm ${textPrimary}`}>{benefit}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href={checkoutUrl}
            className={`block w-full py-4 px-6 rounded-xl font-bold text-center text-white ${ctaGradient} transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`}
          >
            Assinar Premium
          </a>

          <p className={`mt-4 text-center text-xs ${textSecondary}`}>
            Cancele quando quiser. Sem compromisso.
          </p>
        </div>
      </div>
    </div>
  );
}
