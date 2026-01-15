"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";
import RoleButton from "./users/RoleButton";
import { syncMissingProfiles } from "./users/syncActions";

type Profile = {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  email_verified: boolean;
  email_confirmed_at: string | null;
};

export default function AdminPage() {
  const { theme } = useTheme();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    syncedCount?: number;
    totalChecked?: number;
    errors?: string[];
    error?: string;
  } | null>(null);

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      setLoading(true);
      setError(null);

      // Obter sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Obter usuário atual
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      // Log: Sessão atual
      console.log("=== ADMIN DASHBOARD DEBUG ===");
      console.log("1. SESSÃO ATUAL:", {
        session: session ? {
          access_token: session.access_token ? `${session.access_token.substring(0, 20)}...` : null,
          refresh_token: session.refresh_token ? `${session.refresh_token.substring(0, 20)}...` : null,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: session.user ? {
            id: session.user.id,
            email: session.user.email,
            email_confirmed_at: session.user.email_confirmed_at,
          } : null,
        } : null,
        sessionError: sessionError?.message || null,
      });

      // Log: User ID
      console.log("2. USER.ID:", user?.id || "NÃO AUTENTICADO");
      console.log("   User Email:", user?.email || "N/A");
      console.log("   User Error:", userError?.message || null);

      if (!user) {
        setError("Usuário não autenticado");
        setLoading(false);
        return;
      }

      // Busca todos os perfis diretamente da tabela profiles
      // #region agent log
      const logBeforeQuery = {location:'admin/page.tsx:49',message:'before profiles query (client)',data:{userId:user.id,userEmail:user.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'B'};
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logBeforeQuery)}).catch(()=>{});
      // #endregion
      
      const result = await supabase
        .from("profiles")
        .select("id, email, role, created_at")
        .order("created_at", { ascending: false });
      
      const data = result.data;
      const fetchError = result.error;
      
      // Log: Resultado bruto da query do Supabase
      console.log("3. RESULTADO BRUTO DA QUERY SUPABASE:", {
        data: data || null,
        dataLength: data?.length || 0,
        error: fetchError ? {
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint,
          code: fetchError.code,
        } : null,
        status: result.status || null,
        statusText: result.statusText || null,
      });
      console.log("   Total de perfis retornados:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("   Primeiros 3 perfis:", data.slice(0, 3));
      }
      console.log("=== FIM DEBUG ===");
      
      // #region agent log
      const logQueryResult = {location:'admin/page.tsx:58',message:'profiles query result (client)',data:{hasData:!!data,dataLength:data?.length||0,hasError:!!fetchError,errorMessage:fetchError?.message,firstFew:data?.slice(0,3).map((p:Profile)=>({id:p.id,email:p.email}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'B'};
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logQueryResult)}).catch(()=>{});
      // #endregion

      if (fetchError) {
        console.error("Erro ao carregar perfis:", fetchError);
        setError(`Erro ao carregar perfis: ${fetchError.message}`);
        setLoading(false);
        return;
      }

      if (data) {
        // #region agent log
        const logBeforeFilterClient = {location:'admin/page.tsx:70',message:'before filter (client)',data:{dataLength:data.length,allEmails:data.map((p:any)=>p.email)},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'D'};
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logBeforeFilterClient)}).catch(()=>{});
        // #endregion
        
        // Filtrar emails inválidos e tratar null email (caso raro)
        // Ordenar por created_at desc (mais recentes primeiro)
        const validProfiles = (data as any[])
          .filter((p) => {
            // Tratar null email: mostrar como "sem-email@exemplo.com"
            if (!p.email || p.email === 'sem-email@exemplo.com') {
              return false; // Filtra emails inválidos
            }
            return true;
          })
          .map((p) => ({
            ...p,
            email: p.email || 'sem-email@exemplo.com', // Garantir que email nunca seja null
            email_verified: false, // Não temos essa info na query direta
            email_confirmed_at: null,
          }))
          .sort((a, b) => {
            // Ordenar por created_at desc (mais recentes primeiro)
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA; // Descendente
          });
        
        // #region agent log
        const logAfterFilterClient = {location:'admin/page.tsx:80',message:'after filter (client)',data:{validCount:validProfiles.length,validEmails:validProfiles.map((p:Profile)=>p.email)},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'D'};
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logAfterFilterClient)}).catch(()=>{});
        // #endregion
        
        setProfiles(validProfiles as Profile[]);
        
        // #region agent log
        const logSetProfiles = {location:'admin/page.tsx:85',message:'setProfiles called',data:{profilesCount:validProfiles.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'};
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logSetProfiles)}).catch(()=>{});
        // #endregion
      }
    } catch (err: any) {
      console.error("Erro ao carregar perfis:", err);
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Usuários</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>Carregando...</p>
        </div>
      </div>
    );
  }

  async function handleSyncProfiles() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    
    try {
      const result = await syncMissingProfiles();
      setSyncResult(result);
      
      if (result.success) {
        // Recarregar perfis após sincronização
        await loadProfiles();
      } else {
        setError(result.error || "Erro ao sincronizar perfis");
      }
    } catch (err: any) {
      setError(`Erro: ${err.message}`);
      setSyncResult({
        success: false,
        error: err.message,
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${textPrimary}`}>Usuários Cadastrados</h1>
          <p className={`mt-1 text-sm ${textSecondary}`}>
            Lista de todos os usuários do sistema
          </p>
        </div>
        <button
          onClick={handleSyncProfiles}
          disabled={syncing || loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            syncing || loading
              ? "bg-zinc-400 text-zinc-600 cursor-not-allowed"
              : theme === "dark"
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {syncing ? "Sincronizando..." : "Re-sincronizar Perfis"}
        </button>
      </div>

      {syncResult && (
        <div className={`rounded-xl border p-4 ${
          syncResult.success
            ? theme === "dark" ? "border-green-700 bg-green-900/20" : "border-green-500 bg-green-50"
            : theme === "dark" ? "border-red-700 bg-red-900/20" : "border-red-500 bg-red-50"
        }`}>
          {syncResult.success ? (
            <div>
              <p className={`text-sm font-medium ${
                theme === "dark" ? "text-green-300" : "text-green-800"
              }`}>
                ✅ Sincronização concluída!
              </p>
              <p className={`text-xs mt-1 ${
                theme === "dark" ? "text-green-400" : "text-green-700"
              }`}>
                {syncResult.syncedCount || 0} perfil(s) sincronizado(s) de {syncResult.totalChecked || 0} verificado(s)
              </p>
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className={`text-xs font-medium ${
                    theme === "dark" ? "text-yellow-300" : "text-yellow-800"
                  }`}>
                    Avisos:
                  </p>
                  <ul className={`text-xs mt-1 list-disc list-inside ${
                    theme === "dark" ? "text-yellow-400" : "text-yellow-700"
                  }`}>
                    {syncResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className={`text-sm ${
              theme === "dark" ? "text-red-300" : "text-red-800"
            }`}>
              ❌ Erro: {syncResult.error || "Erro desconhecido"}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4`}>
          <div className="text-red-500 text-sm whitespace-pre-line">{error}</div>
        </div>
      )}

      {!error && (
        <div className={`rounded-xl border ${cardBorder} ${cardBg} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                    Email
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                    Role
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${textSecondary}`}>
                    Data de Criação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700 dark:divide-zinc-700">
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`px-6 py-8 text-center ${textTertiary}`}>
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className={theme === "dark" ? "hover:bg-zinc-800" : "hover:bg-zinc-50"}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap ${textPrimary}`}>
                        {profile.email || 'sem-email@exemplo.com'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleButton
                          userId={profile.id}
                          currentRole={profile.role || "user"}
                        />
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${textSecondary}`}>
                        {formatDate(profile.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!error && profiles.length > 0 && (
        <div className={`text-sm ${textTertiary}`}>
          Total: {profiles.length} {profiles.length === 1 ? "usuário" : "usuários"}
        </div>
      )}
    </div>
  );
}
