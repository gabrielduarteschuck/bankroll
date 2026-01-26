"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

function NavItem({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const { theme } = useTheme();

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? theme === "dark"
            ? "bg-zinc-800 text-white"
            : "bg-zinc-100 text-zinc-900"
          : theme === "dark"
          ? "text-zinc-300 hover:bg-zinc-800"
          : "text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAnalisesActive = pathname === "/admin/analises-ia" || pathname === "/admin";
  const isMultiplasActive = pathname === "/admin/multiplas";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={`min-h-screen ${
      theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
    }`}>
      {/* Mobile Header */}
      <div className={`md:hidden flex items-center justify-between p-4 border-b ${
        theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
      }`}>
        <div className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-zinc-900"}`}>
          Painel Editorial
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`p-2 rounded-lg ${
            theme === "dark" ? "hover:bg-zinc-800 text-white" : "hover:bg-zinc-100 text-zinc-900"
          }`}
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-b p-4 ${
          theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
        }`}>
          <nav className="space-y-2">
            <Link
              href="/admin/analises-ia"
              onClick={closeMobileMenu}
              className={`block rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                isAnalisesActive
                  ? theme === "dark"
                    ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-200"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : theme === "dark"
                    ? "border-zinc-800 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900"
              }`}
            >
              Análises da IA
            </Link>
            <Link
              href="/admin/multiplas"
              onClick={closeMobileMenu}
              className={`block rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                isMultiplasActive
                  ? theme === "dark"
                    ? "border-amber-500/40 bg-amber-900/20 text-amber-200"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                  : theme === "dark"
                    ? "border-zinc-800 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-900"
              }`}
            >
              Gerador de Múltiplas
            </Link>
            <NavItem href="/admin/users" label="Usuários" onClick={closeMobileMenu} />
            <NavItem href="/admin/metricas" label="Métricas" onClick={closeMobileMenu} />
            <NavItem href="/admin/entradas-publicadas" label="Entradas publicadas" onClick={closeMobileMenu} />
            <NavItem href="/admin/relatorios" label="Relatórios" onClick={closeMobileMenu} />
            <div className="pt-2 border-t border-zinc-700">
              <NavItem href="/dashboard" label="← Voltar ao Dashboard" onClick={closeMobileMenu} />
            </div>
          </nav>
        </div>
      )}

      <div className="flex">
        {/* Sidebar Desktop */}
        <aside className={`hidden w-64 flex-col border-r p-4 md:flex ${
          theme === "dark"
            ? "border-zinc-800 bg-zinc-900"
            : "border-zinc-200 bg-white"
        }`}>
          <div className={`mb-4 rounded-2xl border p-4 ${
            theme === "dark"
              ? "border-zinc-800 bg-zinc-900"
              : "border-zinc-200 bg-white"
          }`}>
            <div className={`text-sm font-semibold ${
              theme === "dark" ? "text-white" : "text-zinc-900"
            }`}>
              Painel Editorial
            </div>
            <div className={`mt-1 text-xs ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}>
              Publicação de análises
            </div>
          </div>

          <nav className="space-y-1">
            <Link
              href="/admin/analises-ia"
              className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                isAnalisesActive
                  ? theme === "dark"
                    ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-200 shadow-lg shadow-emerald-500/10"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-md"
                  : theme === "dark"
                    ? "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800"
                    : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Análises da IA
              <div className={`mt-1 text-xs font-medium ${
                isAnalisesActive
                  ? theme === "dark"
                    ? "text-emerald-200/80"
                    : "text-emerald-700"
                  : theme === "dark"
                    ? "text-zinc-400"
                    : "text-zinc-500"
              }`}>
                Painel de publicação
              </div>
            </Link>

            <Link
              href="/admin/multiplas"
              className={`block rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                isMultiplasActive
                  ? theme === "dark"
                    ? "border-amber-500/40 bg-amber-900/20 text-amber-200 shadow-lg shadow-amber-500/10"
                    : "border-amber-300 bg-amber-50 text-amber-800 shadow-md"
                  : theme === "dark"
                    ? "border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-800"
                    : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              Gerador de Múltiplas
              <div className={`mt-1 text-xs font-medium ${
                isMultiplasActive
                  ? theme === "dark"
                    ? "text-amber-200/80"
                    : "text-amber-700"
                  : theme === "dark"
                    ? "text-zinc-400"
                    : "text-zinc-500"
              }`}>
                Múltiplas Premium
              </div>
            </Link>

            <NavItem href="/admin/users" label="Usuários" />
            <NavItem href="/admin/metricas" label="Métricas" />
            <NavItem href="/admin/entradas-publicadas" label="Entradas publicadas" />
            <NavItem href="/admin/relatorios" label="Relatórios" />
          </nav>

          <div className="mt-4">
            <Link
              href="/dashboard"
              className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                theme === "dark"
                  ? "text-zinc-300 hover:bg-zinc-800"
                  : "text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              ← Voltar ao Dashboard
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main className={`flex-1 p-4 md:p-8 ${
          theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
        }`}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
