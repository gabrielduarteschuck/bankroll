"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

export default function RegistrarEntradasTipoPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const hoverCard =
    theme === "dark"
      ? "hover:border-zinc-700 hover:bg-zinc-900/60"
      : "hover:border-zinc-300 hover:bg-zinc-50";

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Registrar Entradas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Escolha o tipo de registro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/dashboard/registrar-entradas"
          className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm transition-colors ${hoverCard}`}
        >
          <div className={`text-lg font-semibold ${textPrimary}`}>Entrada Simples</div>
          <div className={`mt-2 text-sm ${textSecondary}`}>
            Registro padrão com unidades/odd/resultado para uma única seleção.
          </div>
        </Link>

        <Link
          href="/dashboard/registrar-entradas/multipla"
          className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm transition-colors ${hoverCard}`}
        >
          <div className={`text-lg font-semibold ${textPrimary}`}>Múltipla</div>
          <div className={`mt-2 text-sm ${textSecondary}`}>
            Aposta combinada com 2+ seleções, odd combinada e resultado pendente/green/red.
          </div>
        </Link>
      </div>
    </div>
  );
}

