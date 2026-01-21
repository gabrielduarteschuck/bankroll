"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";

export default function AjustesPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  const [userEmail, setUserEmail] = useState("");
  const [userNome, setUserNome] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  function formatBRPhone(digits: string): string {
    const d = digits.replace(/\D/g, "").slice(0, 11); // trava em 11
    if (!d) return "";
    if (d.length <= 2) return `(${d}`;
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length <= 5) return `(${ddd}) ${rest}`;
    const part1 = rest.slice(0, 5);
    const part2 = rest.slice(5, 9);
    return `(${ddd}) ${part1}${part2 ? `-${part2}` : ""}`;
  }

  function phoneE164OrNull(): string | null {
    const d = phoneDigits.replace(/\D/g, "").slice(0, 11);
    if (!d) return null;
    if (d.length !== 11) return null;
    return `+55${d}`;
  }

  function digitsFromTelefoneValue(v: unknown): string {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return "";
    // aceita +55XXXXXXXXXXX ou números soltos
    const only = s.replace(/\D/g, "");
    if (only.startsWith("55") && only.length >= 13) return only.slice(2, 13);
    return only.slice(0, 11);
  }

  useEffect(() => {
    void (async () => {
      setLoadingUser(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setUserEmail(user.email || "");
        const metaNome =
          typeof (user as any)?.user_metadata?.nome === "string"
            ? String((user as any).user_metadata.nome)
            : typeof (user as any)?.user_metadata?.name === "string"
              ? String((user as any).user_metadata.name)
              : "";
        setUserNome(metaNome);

        // Tenta ler telefone de profiles (fonte principal). Se falhar, cai no metadata.
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("telefone")
          .eq("id", user.id)
          .single();

        if (!error) {
          setPhoneDigits(digitsFromTelefoneValue(profile?.telefone));
        } else {
          const metaTel =
            typeof (user as any)?.user_metadata?.telefone === "string"
              ? String((user as any).user_metadata.telefone)
              : typeof (user as any)?.user_metadata?.phone === "string"
                ? String((user as any).user_metadata.phone)
                : "";
          setPhoneDigits(digitsFromTelefoneValue(metaTel));
        }
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  async function handleSaveUser() {
    if (savingUser) return;

    const nomeFinal = userNome.trim();
    const d = phoneDigits.replace(/\D/g, "").slice(0, 11);
    if (d && d.length !== 11) {
      alert("Celular inválido. Use DDD + número (11 dígitos).");
      return;
    }

    setSavingUser(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("Usuário não autenticado");
        return;
      }

      const telefoneFinal = phoneE164OrNull();

      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          nome: nomeFinal || null,
          telefone: telefoneFinal,
        } as any,
      });

      if (authErr) {
        alert("Erro ao salvar dados do usuário");
        return;
      }

      // Mantém telefone também na tabela profiles (quando existir)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ telefone: telefoneFinal })
        .eq("id", user.id);

      if (profErr) {
        // Best-effort: não bloqueia o fluxo (metadata já foi salvo).
        // Evita "Console Error" no overlay (dev) quando:
        // - coluna telefone ainda não existe
        // - tabela profiles não existe nessa instalação
        // - RLS impede update
        const msg = String((profErr as any)?.message || "").toLowerCase();
        const safeToIgnore =
          msg.includes("telefone") ||
          msg.includes("column") ||
          msg.includes("relation") ||
          msg.includes("profiles") ||
          msg.includes("permission") ||
          msg.includes("not allowed") ||
          msg.includes("rls");

        if (!safeToIgnore) {
          // log leve sem estourar overlay
          console.log("Aviso: não foi possível atualizar profiles.telefone", {
            code: (profErr as any)?.code,
            message: (profErr as any)?.message,
          });
        }
      }

      alert("Dados do usuário atualizados com sucesso!");
    } finally {
      setSavingUser(false);
    }
  }

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
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Dados do usuário</h2>
            <p className={`mt-1 text-sm ${textSecondary}`}>
              Atualize suas informações básicas de cadastro.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveUser}
            disabled={loadingUser || savingUser}
            className={`px-5 py-2.5 rounded-lg font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              theme === "dark"
                ? "bg-zinc-700 text-white hover:bg-zinc-600"
                : "bg-zinc-900 text-white hover:bg-zinc-800"
            }`}
          >
            {savingUser ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {loadingUser ? (
          <div className={`p-4 rounded-lg border ${cardBorder} ${theme === "dark" ? "bg-zinc-800/40" : "bg-zinc-50"}`}>
            <div className={`text-sm ${textSecondary}`}>Carregando dados...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Nome</label>
              <input
                value={userNome}
                onChange={(e) => setUserNome(e.target.value)}
                placeholder="Seu nome"
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
              />
            </div>
            <div className="md:col-span-1">
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Email</label>
              <input
                value={userEmail}
                readOnly
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} opacity-80`}
              />
              <div className={`mt-2 text-xs ${textTertiary}`}>O email não pode ser alterado aqui.</div>
            </div>
            <div className="md:col-span-1">
              <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Celular</label>
              <input
                value={formatBRPhone(phoneDigits)}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500`}
              />
            </div>
          </div>
        )}
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
