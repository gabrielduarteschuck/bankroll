"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import FeedbackWidget from "@/components/FeedbackWidget";
import { useTheme } from "@/contexts/ThemeContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";

function NavItem({
  href,
  label,
  isPremium = false,
}: {
  href: string;
  label: string;
  isPremium?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const { theme } = useTheme();

  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? theme === "dark"
            ? "bg-zinc-800 text-white"
            : "bg-zinc-100 text-zinc-900"
          : theme === "dark"
          ? "text-zinc-300 hover:bg-zinc-800"
          : "text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      <span>{label}</span>
      {isPremium && (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white uppercase tracking-wide">
          Pro
        </span>
      )}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Fecha o menu mobile quando a rota muda
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <AnalyticsProvider>
    <div className={`min-h-screen ${
      theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
    }`}>
      <FeedbackWidget />
      {/* Mobile Header */}
      <div className={`md:hidden flex items-center justify-between p-4 border-b ${
        theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"
      }`}>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`p-2 rounded-lg ${
            theme === "dark" ? "text-zinc-300 hover:bg-zinc-800" : "text-zinc-700 hover:bg-zinc-100"
          }`}
          aria-label="Toggle menu"
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
        <div className="flex items-center gap-2">
          <div
            aria-label="ProStake"
            className="h-7 w-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-black text-sm border border-zinc-700/50"
          >
            S
          </div>
          <div className={`text-sm font-semibold ${
            theme === "dark" ? "text-white" : "text-zinc-900"
          }`}>
            ProStake
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          theme === "dark" ? "bg-zinc-900 border-r border-zinc-800" : "bg-white border-r border-zinc-200"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full p-4 overflow-y-auto">
          <div className={`mb-4 rounded-2xl border p-4 ${
            theme === "dark"
              ? "border-zinc-800 bg-zinc-900"
              : "border-zinc-200 bg-white"
          }`}>
            <div className="flex items-center gap-2">
              <div
                aria-label="ProStake"
                className="h-7 w-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-black text-sm border border-zinc-700/50"
              >
                S
              </div>
              <div className={`text-sm font-semibold ${
                theme === "dark" ? "text-white" : "text-zinc-900"
              }`}>
                ProStake
              </div>
            </div>
          </div>

          <nav className="space-y-1 flex-1">
            <NavItem href="/dashboard" label="Painel" />
            <NavItem href="/dashboard/sugestoes-ia" label="Sugestões da IA" isPremium />
            <NavItem href="/dashboard/gerador-multiplas" label="Gerador de Múltiplas" isPremium />
            <NavItem href="/dashboard/registrar-entradas/tipo" label="Registrar Entradas" />
            <NavItem href="/dashboard/minhas-entradas" label="Minhas Entradas" />
            <NavItem href="/dashboard/banca" label="Banca" />
            <NavItem href="/dashboard/relatorios" label="Relatórios" />
            <NavItem href="/dashboard/dicas" label="Dicas para Iniciantes" />
            <NavItem href="/dashboard/como-funciona" label="Como funciona" />
            <NavItem href="/dashboard/ajustes" label="Ajustes" />
          </nav>

          <div className="mt-4 mb-4">
            <ThemeToggle />
          </div>

          <UserMenu />
        </div>
      </aside>

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
            <div className="flex items-center gap-2">
              <div
                aria-label="ProStake"
                className="h-7 w-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-black text-sm border border-zinc-700/50"
              >
                S
              </div>
              <div className={`text-sm font-semibold ${
                theme === "dark" ? "text-white" : "text-zinc-900"
              }`}>
                ProStake
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem href="/dashboard" label="Painel" />
            <NavItem href="/dashboard/sugestoes-ia" label="Sugestões da IA" isPremium />
            <NavItem href="/dashboard/gerador-multiplas" label="Gerador de Múltiplas" isPremium />
            <NavItem href="/dashboard/registrar-entradas/tipo" label="Registrar Entradas" />
            <NavItem href="/dashboard/minhas-entradas" label="Minhas Entradas" />
            <NavItem href="/dashboard/banca" label="Banca" />
            <NavItem href="/dashboard/relatorios" label="Relatórios" />
            <NavItem href="/dashboard/dicas" label="Dicas para Iniciantes" />
            <NavItem href="/dashboard/como-funciona" label="Como funciona" />
            <NavItem href="/dashboard/ajustes" label="Ajustes" />
          </nav>

          <div className="mt-4 mb-4">
            <ThemeToggle />
          </div>

          <UserMenu />
        </aside>

        {/* Content */}
        <main className={`flex-1 p-4 md:p-8 ${
          theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
        }`}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
    </AnalyticsProvider>
  );
}