"use client";

import { useState } from "react";
import { updateUserRole } from "./actions";
import { useTheme } from "@/contexts/ThemeContext";

type RoleButtonProps = {
  userId: string;
  currentRole: "user" | "admin";
};

export default function RoleButton({ userId, currentRole }: RoleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"user" | "admin">(currentRole);
  const { theme } = useTheme();

  async function handleToggleRole() {
    setLoading(true);
    setError(null);

    const newRole = role === "admin" ? "user" : "admin";

    try {
      const result = await updateUserRole(userId, newRole);

      if (result.success) {
        setRole(newRole);
        // Recarrega a página para atualizar a lista
        window.location.reload();
      } else {
        setError(result.error || "Erro ao atualizar role");
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  const isAdmin = role === "admin";

  const buttonClasses = `
    inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium
    transition-colors disabled:opacity-50 disabled:cursor-not-allowed
    ${
      isAdmin
        ? theme === "dark"
          ? "bg-purple-600 text-white hover:bg-purple-700"
          : "bg-purple-600 text-white hover:bg-purple-700"
        : theme === "dark"
        ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
        : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
    }
  `;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleToggleRole}
        disabled={loading}
        className={buttonClasses}
        title={
          isAdmin
            ? "Clique para remover privilégios de admin"
            : "Clique para promover a admin"
        }
      >
        {loading ? (
          <>
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Atualizando...
          </>
        ) : (
          <>
            {isAdmin ? "👑 Admin" : "👤 User"}
            <span className="text-[10px] opacity-75">
              ({isAdmin ? "Remover" : "Promover"})
            </span>
          </>
        )}
      </button>
      {error && (
        <span className="text-xs text-red-500 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
