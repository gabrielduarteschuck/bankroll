"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type Summary = {
  total_users: number;
  users_with_banca: number;
  users_with_entrada: number;
  total_page_views: number;
  total_sessions: number;
  avg_pages_per_session: number;
};

type TopPage = {
  page_path: string;
  view_count: number;
  unique_users: number;
};

type DropoffPage = {
  page_path: string;
  dropoff_count: number;
};

type AvgTimePage = {
  page_path: string;
  avg_seconds: number;
  total_views: number;
};

type Retention = {
  total_users: number;
  returned_users: number;
  retention_rate: number;
};

type SuggestionClick = {
  suggestion_id: string;
  click_count: number;
  unique_users: number;
};

type UserDetail = {
  user_id: string;
  email: string;
  created_at: string;
  last_activity: string | null;
  total_sessions: number;
  total_page_views: number;
  days_active: number;
  total_entradas: number;
  entradas_green: number;
  entradas_red: number;
  entradas_pendente: number;
  taxa_green: number;
  has_banca: boolean;
};

export default function AdminMetricasPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [dropoffPages, setDropoffPages] = useState<DropoffPage[]>([]);
  const [avgTimePages, setAvgTimePages] = useState<AvgTimePage[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [suggestionClicks, setSuggestionClicks] = useState<SuggestionClick[]>([]);
  const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900/40" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  // Verificar admin
  useEffect(() => {
    void (async () => {
      setChecking(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/dashboard");
          return;
        }

        const { data: isAdminRpc, error: rpcErr } = await supabase.rpc("is_admin", {
          user_id: user.id,
        });

        if (!rpcErr && isAdminRpc === true) {
          setIsAdmin(true);
        } else {
          router.replace("/dashboard");
        }
      } catch {
        router.replace("/dashboard");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  // Carregar métricas
  useEffect(() => {
    if (!isAdmin) return;

    async function loadMetrics() {
      setLoading(true);
      try {
        // Carregar todas as métricas em paralelo
        const [
          summaryRes,
          topPagesRes,
          dropoffRes,
          avgTimeRes,
          retentionRes,
          suggestionsRes,
          usersRes,
        ] = await Promise.all([
          supabase.rpc("analytics_summary"),
          supabase.rpc("analytics_top_pages"),
          supabase.rpc("analytics_dropoff_pages"),
          supabase.rpc("analytics_avg_time_per_page"),
          supabase.rpc("analytics_retention_d1"),
          supabase.rpc("analytics_suggestion_clicks"),
          supabase.rpc("analytics_users_detailed"),
        ]);

        if (summaryRes.data && summaryRes.data.length > 0) {
          setSummary(summaryRes.data[0]);
        }
        if (topPagesRes.data) setTopPages(topPagesRes.data);
        if (dropoffRes.data) setDropoffPages(dropoffRes.data);
        if (avgTimeRes.data) setAvgTimePages(avgTimeRes.data);
        if (retentionRes.data && retentionRes.data.length > 0) {
          setRetention(retentionRes.data[0]);
        }
        if (suggestionsRes.data) setSuggestionClicks(suggestionsRes.data);
        if (usersRes.data) setUserDetails(usersRes.data);
      } catch (error) {
        console.error("Erro ao carregar métricas:", error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [isAdmin]);

  function formatPagePath(path: string): string {
    const map: Record<string, string> = {
      "/dashboard": "Painel",
      "/dashboard/sugestoes-ia": "Sugestões IA",
      "/dashboard/registrar-entradas/tipo": "Registrar Entradas",
      "/dashboard/minhas-entradas": "Minhas Entradas",
      "/dashboard/banca": "Banca",
      "/dashboard/relatorios": "Relatórios",
      "/dashboard/dicas": "Dicas",
      "/dashboard/como-funciona": "Como Funciona",
      "/dashboard/ajustes": "Ajustes",
    };
    return map[path] || path;
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  if (checking) {
    return (
      <div className="space-y-6">
        <div className={`h-7 w-64 rounded-lg animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-64 rounded-3xl border ${cardBorder} ${cardBg} animate-pulse`} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Métricas de Usuários</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Acompanhe o comportamento dos usuários dentro do app.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`h-32 rounded-2xl border ${cardBorder} ${cardBg} animate-pulse`} />
          ))}
        </div>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Total Usuários</div>
              <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                {summary?.total_users || 0}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Criaram Banca</div>
              <div className={`text-3xl font-bold mt-2 text-emerald-500`}>
                {summary?.users_with_banca || 0}
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                {summary && summary.total_users > 0
                  ? `${((summary.users_with_banca / summary.total_users) * 100).toFixed(1)}%`
                  : "0%"}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Registraram Entrada</div>
              <div className={`text-3xl font-bold mt-2 text-blue-500`}>
                {summary?.users_with_entrada || 0}
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                {summary && summary.total_users > 0
                  ? `${((summary.users_with_entrada / summary.total_users) * 100).toFixed(1)}%`
                  : "0%"}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Retenção D1</div>
              <div className={`text-3xl font-bold mt-2 text-purple-500`}>
                {retention?.retention_rate || 0}%
              </div>
              <div className={`text-xs mt-1 ${textSecondary}`}>
                {retention?.returned_users || 0} de {retention?.total_users || 0} voltaram
              </div>
            </div>
          </div>

          {/* Segunda linha */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Total Page Views</div>
              <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                {summary?.total_page_views?.toLocaleString("pt-BR") || 0}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Total Sessões</div>
              <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                {summary?.total_sessions?.toLocaleString("pt-BR") || 0}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
              <div className={`text-xs font-medium uppercase ${textSecondary}`}>Páginas/Sessão</div>
              <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                {summary?.avg_pages_per_session || 0}
              </div>
            </div>
          </div>

          {/* Tabelas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Páginas */}
            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${cardBorder}`}>
                <h3 className={`font-semibold ${textPrimary}`}>Páginas Mais Visitadas</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {topPages.length === 0 ? (
                  <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados ainda</div>
                ) : (
                  topPages.map((page, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {formatPagePath(page.page_path)}
                        </div>
                        <div className={`text-xs ${textSecondary}`}>
                          {page.unique_users} usuários únicos
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${textPrimary}`}>
                        {page.view_count}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Drop-off */}
            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${cardBorder}`}>
                <h3 className={`font-semibold ${textPrimary}`}>Onde Usuários Param (Drop-off)</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {dropoffPages.length === 0 ? (
                  <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados ainda</div>
                ) : (
                  dropoffPages.map((page, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className={`text-sm font-medium ${textPrimary}`}>
                        {formatPagePath(page.page_path)}
                      </div>
                      <div className="text-lg font-bold text-amber-500">
                        {page.dropoff_count}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Tempo Médio */}
            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${cardBorder}`}>
                <h3 className={`font-semibold ${textPrimary}`}>Tempo Médio por Página</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {avgTimePages.length === 0 ? (
                  <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados ainda</div>
                ) : (
                  avgTimePages.map((page, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {formatPagePath(page.page_path)}
                        </div>
                        <div className={`text-xs ${textSecondary}`}>
                          {page.total_views} views
                        </div>
                      </div>
                      <div className={`text-lg font-bold text-cyan-500`}>
                        {formatTime(page.avg_seconds)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Cliques em Sugestões */}
            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${cardBorder}`}>
                <h3 className={`font-semibold ${textPrimary}`}>Cliques em Sugestões IA</h3>
              </div>
              <div className="divide-y divide-zinc-800">
                {suggestionClicks.length === 0 ? (
                  <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados ainda</div>
                ) : (
                  suggestionClicks.slice(0, 10).map((item, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {item.suggestion_id.substring(0, 8)}...
                        </div>
                        <div className={`text-xs ${textSecondary}`}>
                          {item.unique_users} usuários
                        </div>
                      </div>
                      <div className="text-lg font-bold text-emerald-500">
                        {item.click_count}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Métricas por Usuário */}
          <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
            <div className={`px-4 py-3 border-b ${cardBorder} flex items-center justify-between`}>
              <div>
                <h3 className={`font-semibold ${textPrimary}`}>Métricas por Usuário</h3>
                <p className={`text-xs ${textSecondary} mt-0.5`}>
                  {userDetails.length} usuários cadastrados
                </p>
              </div>
              <button
                onClick={() => setShowAllUsers(!showAllUsers)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  theme === "dark"
                    ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {showAllUsers ? "Mostrar menos" : `Ver todos (${userDetails.length})`}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`text-xs font-medium uppercase ${textSecondary} border-b ${cardBorder}`}>
                    <th className="text-left px-4 py-3">Usuário</th>
                    <th className="text-center px-3 py-3">Banca</th>
                    <th className="text-center px-3 py-3">Sessões</th>
                    <th className="text-center px-3 py-3">Views</th>
                    <th className="text-center px-3 py-3">Dias Ativos</th>
                    <th className="text-center px-3 py-3">Entradas</th>
                    <th className="text-center px-3 py-3">Green</th>
                    <th className="text-center px-3 py-3">Red</th>
                    <th className="text-center px-3 py-3">Taxa</th>
                    <th className="text-right px-4 py-3">Última Atividade</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${cardBorder}`}>
                  {userDetails.length === 0 ? (
                    <tr>
                      <td colSpan={10} className={`px-4 py-8 text-center ${textSecondary}`}>
                        Sem dados ainda
                      </td>
                    </tr>
                  ) : (
                    (showAllUsers ? userDetails : userDetails.slice(0, 10)).map((user) => (
                      <tr key={user.user_id} className={`${theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"}`}>
                        <td className="px-4 py-3">
                          <div className={`text-sm font-medium ${textPrimary}`}>
                            {user.email}
                          </div>
                          <div className={`text-xs ${textSecondary}`}>
                            Desde {new Date(user.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td className="text-center px-3 py-3">
                          {user.has_banca ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-500/20 text-zinc-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </span>
                          )}
                        </td>
                        <td className={`text-center px-3 py-3 text-sm font-medium ${textPrimary}`}>
                          {user.total_sessions}
                        </td>
                        <td className={`text-center px-3 py-3 text-sm font-medium ${textPrimary}`}>
                          {user.total_page_views}
                        </td>
                        <td className={`text-center px-3 py-3 text-sm font-medium ${textPrimary}`}>
                          {user.days_active}
                        </td>
                        <td className={`text-center px-3 py-3 text-sm font-medium ${textPrimary}`}>
                          {user.total_entradas}
                        </td>
                        <td className="text-center px-3 py-3 text-sm font-medium text-emerald-500">
                          {user.entradas_green}
                        </td>
                        <td className="text-center px-3 py-3 text-sm font-medium text-red-500">
                          {user.entradas_red}
                        </td>
                        <td className="text-center px-3 py-3">
                          {user.total_entradas > 0 && (user.entradas_green + user.entradas_red) > 0 ? (
                            <span className={`text-sm font-bold ${
                              user.taxa_green >= 50 ? "text-emerald-500" : "text-red-500"
                            }`}>
                              {user.taxa_green}%
                            </span>
                          ) : (
                            <span className={`text-sm ${textSecondary}`}>-</span>
                          )}
                        </td>
                        <td className={`text-right px-4 py-3 text-xs ${textSecondary}`}>
                          {user.last_activity
                            ? new Date(user.last_activity).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Sem atividade"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
