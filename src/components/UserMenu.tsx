"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import type { User } from "@supabase/supabase-js";

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    // Busca o usuário atual
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUser(user);
      setLoading(false);
    });

    // Escuta mudanças na autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User | null } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className={`mt-auto rounded-xl border p-4 ${
        theme === "dark"
          ? "border-zinc-800 bg-zinc-900"
          : "border-zinc-200 bg-white"
      }`}>
        <div className={`text-xs ${
          theme === "dark" ? "text-zinc-400" : "text-zinc-500"
        }`}>
          Carregando...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`mt-auto min-w-0 rounded-xl border p-4 ${
      theme === "dark"
        ? "border-zinc-800 bg-zinc-900"
        : "border-zinc-200 bg-white"
    }`}>
      <div className="mb-3">
        <div className={`text-xs font-medium ${
          theme === "dark" ? "text-zinc-400" : "text-zinc-500"
        }`}>
          Usuário
        </div>
        <div className={`mt-1 min-w-0 text-sm font-semibold ${
          theme === "dark" ? "text-white" : "text-zinc-900"
        }`}>
          <span
            className="block max-w-full truncate"
            title={user.email ?? ""}
          >
            {user.email}
          </span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          theme === "dark"
            ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
        }`}
      >
        Sair
      </button>
    </div>
  );
}