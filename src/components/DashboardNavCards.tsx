"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

const navigationCards = [
  {
    href: "/dashboard/registrar-entradas/tipo",
    label: "Registrar Entradas",
    description: "Adicionar novas apostas",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
    color: "emerald",
  },
  {
    href: "/dashboard/minhas-entradas",
    label: "Minhas Entradas",
    description: "Histórico de apostas",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    color: "blue",
  },
  {
    href: "/dashboard/banca",
    label: "Banca",
    description: "Gerenciar capital",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "purple",
  },
  {
    href: "/dashboard/relatorios",
    label: "Relatório",
    description: "Análise de desempenho",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: "amber",
  },
];

export default function DashboardNavCards() {
  const { theme } = useTheme();

  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";

  const getCardColors = (color: string) => {
    const colors: Record<string, { icon: string; hover: string }> = {
      emerald: {
        icon: theme === "dark" ? "text-emerald-400" : "text-emerald-600",
        hover: theme === "dark" ? "hover:border-emerald-500/40" : "hover:border-emerald-300",
      },
      blue: {
        icon: theme === "dark" ? "text-blue-400" : "text-blue-600",
        hover: theme === "dark" ? "hover:border-blue-500/40" : "hover:border-blue-300",
      },
      purple: {
        icon: theme === "dark" ? "text-purple-400" : "text-purple-600",
        hover: theme === "dark" ? "hover:border-purple-500/40" : "hover:border-purple-300",
      },
      amber: {
        icon: theme === "dark" ? "text-amber-400" : "text-amber-600",
        hover: theme === "dark" ? "hover:border-amber-500/40" : "hover:border-amber-300",
      },
    };
    return colors[color] || colors.emerald;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {navigationCards.map((card) => {
        const colors = getCardColors(card.color);
        return (
          <Link
            key={card.href}
            href={card.href}
            className={`group relative rounded-xl border ${cardBorder} ${cardBg} p-4 transition-all duration-200 ${colors.hover} hover:shadow-md ${
              theme === "dark" ? "hover:shadow-black/20" : "hover:shadow-zinc-200"
            }`}
          >
            <div className={`mb-3 ${colors.icon}`}>
              {card.icon}
            </div>
            <div className={`text-sm font-semibold ${textPrimary} mb-1`}>
              {card.label}
            </div>
            <div className={`text-xs ${textSecondary} leading-tight`}>
              {card.description}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
