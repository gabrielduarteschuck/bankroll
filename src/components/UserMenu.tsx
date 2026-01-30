"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import type { User } from "@supabase/supabase-js";

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: { user: User | null } | null) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className={`p-2 rounded-lg ${
        theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"
      }`}>
        <div className="w-5 h-5 rounded-full bg-zinc-500 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Pegar iniciais do email
  const emailInitial = user.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 p-1.5 pr-3 rounded-lg transition-colors cursor-pointer ${
          theme === "dark"
            ? "hover:bg-zinc-800"
            : "hover:bg-zinc-100"
        }`}
        aria-label="Menu do usuário"
        aria-expanded={isOpen}
      >
        {/* Avatar */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
          theme === "dark"
            ? "bg-zinc-700 text-zinc-200"
            : "bg-zinc-200 text-zinc-700"
        }`}>
          {emailInitial}
        </div>
        {/* Email (hidden on mobile) */}
        <span
          className={`hidden sm:block max-w-[140px] truncate text-sm ${
            theme === "dark" ? "text-zinc-300" : "text-zinc-600"
          }`}
          title={user.email ?? ""}
        >
          {user.email}
        </span>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""} ${
            theme === "dark" ? "text-zinc-500" : "text-zinc-400"
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-lg z-50 ${
            theme === "dark"
              ? "bg-zinc-900 border-zinc-800"
              : "bg-white border-zinc-200"
          }`}
        >
          {/* Email info (mobile only) */}
          <div className={`sm:hidden px-4 py-3 border-b ${
            theme === "dark" ? "border-zinc-800" : "border-zinc-100"
          }`}>
            <div className={`text-xs ${
              theme === "dark" ? "text-zinc-500" : "text-zinc-400"
            }`}>
              Conectado como
            </div>
            <div
              className={`text-sm font-medium truncate mt-0.5 ${
                theme === "dark" ? "text-zinc-200" : "text-zinc-800"
              }`}
              title={user.email ?? ""}
            >
              {user.email}
            </div>
          </div>

          <div className="p-2">
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                theme === "dark"
                  ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
