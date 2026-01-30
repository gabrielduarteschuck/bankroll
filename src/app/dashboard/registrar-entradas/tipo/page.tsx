"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

export default function RegistrarEntradasTipoPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Registrar Entradas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Escolha o tipo de registro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Entrada Simples */}
        <Link
          href="/dashboard/registrar-entradas"
          className={`group relative overflow-hidden rounded-2xl border ${cardBorder} ${cardBg} p-6 transition-all duration-300 ${
            theme === "dark"
              ? "hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10"
              : "hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100"
          }`}
        >
          <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
            theme === "dark" ? "bg-emerald-500/10" : "bg-emerald-50"
          }`}>
            <svg
              className={`h-6 w-6 ${theme === "dark" ? "text-emerald-400" : "text-emerald-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className={`text-lg font-semibold ${textPrimary} mb-2`}>Entrada Simples</div>
          <p className={`text-sm ${textSecondary} leading-relaxed`}>
            Registro padrão com unidades, odd e resultado para uma única seleção.
          </p>
          <div className={`mt-4 inline-flex items-center gap-2 text-sm font-medium ${
            theme === "dark" ? "text-emerald-400" : "text-emerald-600"
          }`}>
            <span>Registrar</span>
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Múltipla */}
        <Link
          href="/dashboard/registrar-entradas/multipla"
          className={`group relative overflow-hidden rounded-2xl border ${cardBorder} ${cardBg} p-6 transition-all duration-300 ${
            theme === "dark"
              ? "hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
              : "hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100"
          }`}
        >
          <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
            theme === "dark" ? "bg-blue-500/10" : "bg-blue-50"
          }`}>
            <svg
              className={`h-6 w-6 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div className={`text-lg font-semibold ${textPrimary} mb-2`}>Múltipla</div>
          <p className={`text-sm ${textSecondary} leading-relaxed`}>
            Aposta combinada com 2+ seleções e odd combinada.
          </p>
          <div className={`mt-4 inline-flex items-center gap-2 text-sm font-medium ${
            theme === "dark" ? "text-blue-400" : "text-blue-600"
          }`}>
            <span>Registrar</span>
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}

