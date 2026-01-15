"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";

export default function AjustesPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  async function handleRedefinirTudo() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Usuário não autenticado");
        setLoading(false);
        setConfirming(false);
        return;
      }

      // Deleta todas as entradas do usuário
      const { error: entradasError } = await supabase
        .from("entradas")
        .delete()
        .eq("user_id", user.id);

      if (entradasError) {
        console.error("Erro ao deletar entradas:", entradasError);
        alert(`Erro ao deletar entradas: ${entradasError.message}`);
        setLoading(false);
        setConfirming(false);
        return;
      }

      // Deleta a banca do usuário
      const { error: bancaError } = await supabase
        .from("banca")
        .delete()
        .eq("user_id", user.id);

      if (bancaError && bancaError.code !== "PGRST116") {
        console.error("Erro ao deletar banca:", bancaError);
        // Continua mesmo se não houver banca para deletar
      }

      alert(
        "✅ Processo redefinido com sucesso!\n\n" +
        "Todos os dados foram zerados. Agora você pode começar novamente definindo uma nova banca."
      );

      // Redireciona para a página de Banca
      router.push("/dashboard/banca");
      router.refresh();
    } catch (error: any) {
      console.error("Erro ao redefinir processo:", error);
      alert(`Erro ao redefinir processo: ${error.message}`);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Ajustes</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Gerencie as configurações do seu dashboard
        </p>
      </div>

      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Redefinir Processo
        </h2>
        <p className={`text-sm ${textSecondary} mb-6`}>
          Esta ação irá{" "}
          <strong className={textPrimary}>
            deletar permanentemente todas as suas entradas e a banca configurada
          </strong>
          . Você poderá começar novamente do zero definindo uma nova banca.
        </p>

        {!confirming ? (
          <button
            onClick={handleRedefinirTudo}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              theme === "dark"
                ? "bg-red-700 text-white hover:bg-red-600"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            {loading ? "Processando..." : "Redefinir Todo Processo"}
          </button>
        ) : (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${
              theme === "dark"
                ? "bg-red-900/20 border-red-800 text-red-300"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <div className="font-semibold mb-2">⚠️ Atenção!</div>
              <div className="text-sm">
                Esta ação é <strong>irreversível</strong>. Todos os seus dados serão
                permanentemente deletados:
              </div>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>Todas as entradas registradas</li>
                <li>Banca inicial e atual</li>
                <li>Histórico completo</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRedefinirTudo}
                disabled={loading}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-red-700 text-white hover:bg-red-600"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {loading ? "Processando..." : "Sim, Redefinir Tudo"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
