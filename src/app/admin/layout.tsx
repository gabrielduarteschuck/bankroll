"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";

function NavItem({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const { theme } = useTheme();

  return (
    <Link
      href={href}
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
  const isAnalisesActive = pathname === "/admin/analises-ia" || pathname === "/admin";

  return (
    <div className={`min-h-screen ${
      theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
    }`}>
      <div className="flex">
        {/* Sidebar */}
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
