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
              Admin Panel
            </div>
            <div className={`mt-1 text-xs ${
              theme === "dark" ? "text-zinc-400" : "text-zinc-500"
            }`}>
              Painel administrativo
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem href="/admin" label="Dashboard" />
            <NavItem href="/admin/users" label="Gerenciar Usuários" />
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
