"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type Summary = {
  total_users: number;
  users_paid: number;
  users_onboarding_completed: number;
  users_with_banca: number;
  users_with_entrada: number;
  total_page_views: number;
  total_sessions: number;
  avg_pages_per_session: number;
  users_active_today: number;
  users_active_week: number;
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

type UserDetail = {
  user_id: string;
  email: string;
  created_at: string;
  last_activity: string | null;
  is_paid: boolean;
  onboarding_completed: boolean;
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
  const [userDetails, setUserDetails] = useState<UserDetail[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [userFilter, setUserFilter] = useState<"all" | "paid" | "free" | "onboarded" | "not_onboarded">("all");
  const [searchEmail, setSearchEmail] = useState("");

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900/50" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-zinc-100";

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
        const [
          summaryRes,
          topPagesRes,
          dropoffRes,
          avgTimeRes,
          retentionRes,
          usersRes,
        ] = await Promise.all([
          supabase.rpc("analytics_summary"),
          supabase.rpc("analytics_top_pages"),
          supabase.rpc("analytics_dropoff_pages"),
          supabase.rpc("analytics_avg_time_per_page"),
          supabase.rpc("analytics_retention_d1"),
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

  function calcPercent(value: number, total: number): string {
    if (total === 0) return "0";
    return ((value / total) * 100).toFixed(1);
  }

  const filteredUsers = userDetails.filter((user) => {
    const matchesSearch = searchEmail === "" || user.email.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesFilter =
      userFilter === "all" ||
      (userFilter === "paid" && user.is_paid) ||
      (userFilter === "free" && !user.is_paid) ||
      (userFilter === "onboarded" && user.onboarding_completed) ||
      (userFilter === "not_onboarded" && !user.onboarding_completed);
    return matchesSearch && matchesFilter;
  });

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>Métricas & Analytics</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Acompanhe a jornada dos seus leads e usuários em tempo real.
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
          {/* ============================================ */}
          {/* SEÇÃO 1: FUNIL DE CONVERSÃO */}
          {/* ============================================ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h14M3 12h10M3 16h6" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Funil de Conversão</h2>
            </div>

            <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6`}>
              {/* Funnel Visual */}
              <div className="space-y-4">
                {/* Total Cadastros */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>Cadastros</span>
                    <span className={`text-sm font-bold ${textPrimary}`}>{summary?.total_users || 0}</span>
                  </div>
                  <div className={`h-10 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"} overflow-hidden`}>
                    <div className="h-full bg-gradient-to-r from-zinc-500 to-zinc-600 rounded-lg flex items-center justify-center" style={{ width: "100%" }}>
                      <span className="text-xs font-bold text-white">100%</span>
                    </div>
                  </div>
                </div>

                {/* Pagos */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>Pagantes</span>
                    <span className="text-sm font-bold text-emerald-500">{summary?.users_paid || 0}</span>
                  </div>
                  <div className={`h-10 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"} overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center transition-all"
                      style={{ width: `${calcPercent(summary?.users_paid || 0, summary?.total_users || 1)}%`, minWidth: summary?.users_paid ? "50px" : "0" }}
                    >
                      <span className="text-xs font-bold text-white">{calcPercent(summary?.users_paid || 0, summary?.total_users || 1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Onboarding Completo */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>Onboarding Completo</span>
                    <span className="text-sm font-bold text-blue-500">{summary?.users_onboarding_completed || 0}</span>
                  </div>
                  <div className={`h-10 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"} overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center transition-all"
                      style={{ width: `${calcPercent(summary?.users_onboarding_completed || 0, summary?.total_users || 1)}%`, minWidth: summary?.users_onboarding_completed ? "50px" : "0" }}
                    >
                      <span className="text-xs font-bold text-white">{calcPercent(summary?.users_onboarding_completed || 0, summary?.total_users || 1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Com Banca */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>Criaram Banca</span>
                    <span className="text-sm font-bold text-purple-500">{summary?.users_with_banca || 0}</span>
                  </div>
                  <div className={`h-10 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"} overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center transition-all"
                      style={{ width: `${calcPercent(summary?.users_with_banca || 0, summary?.total_users || 1)}%`, minWidth: summary?.users_with_banca ? "50px" : "0" }}
                    >
                      <span className="text-xs font-bold text-white">{calcPercent(summary?.users_with_banca || 0, summary?.total_users || 1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Com Entradas */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${textPrimary}`}>Registraram Entrada</span>
                    <span className="text-sm font-bold text-amber-500">{summary?.users_with_entrada || 0}</span>
                  </div>
                  <div className={`h-10 rounded-lg ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-100"} overflow-hidden`}>
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex items-center justify-center transition-all"
                      style={{ width: `${calcPercent(summary?.users_with_entrada || 0, summary?.total_users || 1)}%`, minWidth: summary?.users_with_entrada ? "50px" : "0" }}
                    >
                      <span className="text-xs font-bold text-white">{calcPercent(summary?.users_with_entrada || 0, summary?.total_users || 1)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conversion Rates */}
              <div className={`mt-6 pt-6 border-t ${cardBorder} grid grid-cols-2 md:grid-cols-4 gap-4`}>
                <div className="text-center">
                  <div className={`text-2xl font-bold text-emerald-500`}>
                    {calcPercent(summary?.users_paid || 0, summary?.total_users || 1)}%
                  </div>
                  <div className={`text-xs ${textSecondary}`}>Taxa de Conversão</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold text-blue-500`}>
                    {calcPercent(summary?.users_onboarding_completed || 0, summary?.users_paid || 1)}%
                  </div>
                  <div className={`text-xs ${textSecondary}`}>Pagos → Onboarding</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold text-purple-500`}>
                    {calcPercent(summary?.users_with_banca || 0, summary?.users_onboarding_completed || 1)}%
                  </div>
                  <div className={`text-xs ${textSecondary}`}>Onboarding → Banca</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold text-amber-500`}>
                    {calcPercent(summary?.users_with_entrada || 0, summary?.users_with_banca || 1)}%
                  </div>
                  <div className={`text-xs ${textSecondary}`}>Banca → Entrada</div>
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SEÇÃO 2: ENGAJAMENTO */}
          {/* ============================================ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Engajamento</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Ativos Hoje</div>
                <div className={`text-3xl font-bold mt-2 text-cyan-500`}>
                  {summary?.users_active_today || 0}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Ativos 7 dias</div>
                <div className={`text-3xl font-bold mt-2 text-blue-500`}>
                  {summary?.users_active_week || 0}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Retenção D1</div>
                <div className={`text-3xl font-bold mt-2 text-purple-500`}>
                  {retention?.retention_rate || 0}%
                </div>
                <div className={`text-xs mt-1 ${textSecondary}`}>
                  {retention?.returned_users || 0}/{retention?.total_users || 0}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Total Sessões</div>
                <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                  {summary?.total_sessions?.toLocaleString("pt-BR") || 0}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Page Views</div>
                <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                  {summary?.total_page_views?.toLocaleString("pt-BR") || 0}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}>
                <div className={`text-xs font-medium uppercase ${textSecondary}`}>Págs/Sessão</div>
                <div className={`text-3xl font-bold mt-2 ${textPrimary}`}>
                  {summary?.avg_pages_per_session || 0}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SEÇÃO 3: ANÁLISE DE PÁGINAS */}
          {/* ============================================ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Análise de Páginas</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Páginas */}
              <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${cardBorder} bg-gradient-to-r from-emerald-500/10 to-transparent`}>
                  <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Mais Visitadas
                  </h3>
                </div>
                <div className={`divide-y ${cardBorder}`}>
                  {topPages.length === 0 ? (
                    <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados</div>
                  ) : (
                    topPages.slice(0, 5).map((page, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-medium ${textPrimary}`}>
                            {formatPagePath(page.page_path)}
                          </div>
                          <div className={`text-xs ${textSecondary}`}>
                            {page.unique_users} usuários
                          </div>
                        </div>
                        <div className="text-lg font-bold text-emerald-500">
                          {page.view_count}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Drop-off */}
              <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${cardBorder} bg-gradient-to-r from-red-500/10 to-transparent`}>
                  <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Drop-off (Saídas)
                  </h3>
                </div>
                <div className={`divide-y ${cardBorder}`}>
                  {dropoffPages.length === 0 ? (
                    <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados</div>
                  ) : (
                    dropoffPages.slice(0, 5).map((page, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div className={`text-sm font-medium ${textPrimary}`}>
                          {formatPagePath(page.page_path)}
                        </div>
                        <div className="text-lg font-bold text-red-500">
                          {page.dropoff_count}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tempo Médio */}
              <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
                <div className={`px-4 py-3 border-b ${cardBorder} bg-gradient-to-r from-cyan-500/10 to-transparent`}>
                  <h3 className={`font-semibold ${textPrimary} flex items-center gap-2`}>
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    Tempo Médio
                  </h3>
                </div>
                <div className={`divide-y ${cardBorder}`}>
                  {avgTimePages.length === 0 ? (
                    <div className={`px-4 py-8 text-center ${textSecondary}`}>Sem dados</div>
                  ) : (
                    avgTimePages.slice(0, 5).map((page, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className={`text-sm font-medium ${textPrimary}`}>
                            {formatPagePath(page.page_path)}
                          </div>
                          <div className={`text-xs ${textSecondary}`}>
                            {page.total_views} views
                          </div>
                        </div>
                        <div className="text-lg font-bold text-cyan-500">
                          {formatTime(page.avg_seconds)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* SEÇÃO 4: LISTA DE USUÁRIOS */}
          {/* ============================================ */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Usuários Detalhados</h2>
            </div>

            <div className={`rounded-2xl border ${cardBorder} ${cardBg} overflow-hidden`}>
              {/* Filtros */}
              <div className={`px-4 py-4 border-b ${cardBorder} flex flex-col md:flex-row gap-4`}>
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Buscar por email..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className={`w-full px-4 py-2 rounded-xl text-sm ${inputBg} ${textPrimary} border ${cardBorder} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "all", label: "Todos", count: userDetails.length },
                    { key: "paid", label: "Pagos", count: userDetails.filter((u) => u.is_paid).length },
                    { key: "free", label: "Free", count: userDetails.filter((u) => !u.is_paid).length },
                    { key: "onboarded", label: "Onboarded", count: userDetails.filter((u) => u.onboarding_completed).length },
                    { key: "not_onboarded", label: "Não Onboarded", count: userDetails.filter((u) => !u.onboarding_completed).length },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setUserFilter(filter.key as typeof userFilter)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        userFilter === filter.key
                          ? "bg-blue-500 text-white"
                          : `${inputBg} ${textSecondary} hover:${theme === "dark" ? "bg-zinc-700" : "bg-zinc-200"}`
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className={`px-4 py-2 border-b ${cardBorder} flex items-center justify-between`}>
                <span className={`text-xs ${textSecondary}`}>
                  Mostrando {showAllUsers ? filteredUsers.length : Math.min(15, filteredUsers.length)} de {filteredUsers.length} usuários
                </span>
                {filteredUsers.length > 15 && (
                  <button
                    onClick={() => setShowAllUsers(!showAllUsers)}
                    className={`text-xs font-medium text-blue-500 hover:underline`}
                  >
                    {showAllUsers ? "Mostrar menos" : "Ver todos"}
                  </button>
                )}
              </div>

              {/* Tabela */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`text-xs font-medium uppercase ${textSecondary} border-b ${cardBorder}`}>
                      <th className="text-left px-4 py-3">Usuário</th>
                      <th className="text-center px-3 py-3">Status</th>
                      <th className="text-center px-3 py-3">Onboarding</th>
                      <th className="text-center px-3 py-3">Sessões</th>
                      <th className="text-center px-3 py-3">Views</th>
                      <th className="text-center px-3 py-3">Entradas</th>
                      <th className="text-center px-3 py-3">Green/Red</th>
                      <th className="text-center px-3 py-3">Taxa</th>
                      <th className="text-right px-4 py-3">Última Ativ.</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${cardBorder}`}>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className={`px-4 py-8 text-center ${textSecondary}`}>
                          Nenhum usuário encontrado
                        </td>
                      </tr>
                    ) : (
                      (showAllUsers ? filteredUsers : filteredUsers.slice(0, 15)).map((user) => (
                        <tr key={user.user_id} className={`${theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"}`}>
                          <td className="px-4 py-3">
                            <div className={`text-sm font-medium ${textPrimary}`}>
                              {user.email}
                            </div>
                            <div className={`text-xs ${textSecondary}`}>
                              {new Date(user.created_at).toLocaleDateString("pt-BR")}
                            </div>
                          </td>
                          <td className="text-center px-3 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_paid
                                ? "bg-emerald-500/20 text-emerald-500"
                                : "bg-zinc-500/20 text-zinc-500"
                            }`}>
                              {user.is_paid ? "Pago" : "Free"}
                            </span>
                          </td>
                          <td className="text-center px-3 py-3">
                            {user.onboarding_completed ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                            {user.total_entradas}
                          </td>
                          <td className="text-center px-3 py-3 text-sm">
                            <span className="text-emerald-500 font-medium">{user.entradas_green}</span>
                            <span className={textSecondary}>/</span>
                            <span className="text-red-500 font-medium">{user.entradas_red}</span>
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
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
