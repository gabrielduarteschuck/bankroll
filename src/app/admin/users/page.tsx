"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type Toast = { type: "success" | "error"; message: string } | null;

type UserWithPayment = {
  id: string;
  email: string;
  telefone: string | null;
  created_at: string;
  is_paid: boolean;
  subscription_status: string | null;
};

type FilterType = "all" | "paid" | "unpaid";

type Profile = {
  id: string;
  email: string;
  telefone: string | null;
  created_at: string;
};

type PaymentRecord = {
  email: string;
  is_paid: boolean;
  subscription_status: string | null;
};

const PAGE_SIZE = 50;

export default function AdminUsersPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900/40" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-900/40" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";
  const tableBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const tableRowHover = theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50";

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [users, setUsers] = useState<UserWithPayment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchEmail, setSearchEmail] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Verificar se é admin
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

        let ok = false;
        const { data: isAdminRpc, error: rpcErr } = await supabase.rpc("is_admin", {
          user_id: user.id,
        });

        if (!rpcErr && isAdminRpc === true) {
          ok = true;
        } else {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_admin, role")
            .eq("id", user.id)
            .single();

          if (error) {
            router.replace("/dashboard");
            return;
          }

          ok = profile?.is_admin === true || profile?.role === "admin";
        }

        setIsAdmin(ok);
        if (!ok) router.replace("/dashboard");
      } catch (err) {
        const name = String((err as Error)?.name || "");
        const msg = String((err as Error)?.message || "");
        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) {
          return;
        }
        console.error("Erro ao verificar admin (users):", err);
        router.replace("/dashboard");
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Buscar usuários
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar profiles
      let query = supabase
        .from("profiles")
        .select("id, email, telefone, created_at", { count: "exact" });

      // Filtro de busca por email
      if (searchEmail.trim()) {
        query = query.ilike("email", `%${searchEmail.trim()}%`);
      }

      // Ordenação e paginação
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: profiles, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Erro ao buscar profiles:", error);
        setToast({ type: "error", message: "Erro ao carregar usuários." });
        return;
      }

      if (!profiles || profiles.length === 0) {
        setUsers([]);
        setTotalCount(count || 0);
        return;
      }

      // Buscar status de pagamento para cada usuário
      const emails = (profiles as Profile[]).map((p: Profile) => p.email.toLowerCase());
      const { data: payments, error: paymentsError } = await supabase
        .from("stripe_payments")
        .select("email, is_paid, subscription_status")
        .in("email", emails);

      if (paymentsError) {
        console.error("Erro ao buscar pagamentos:", paymentsError);
      }

      // Mapear pagamentos por email
      const paymentMap = new Map<string, { is_paid: boolean; subscription_status: string | null }>();
      if (payments) {
        for (const p of payments as PaymentRecord[]) {
          paymentMap.set(p.email.toLowerCase(), {
            is_paid: p.is_paid,
            subscription_status: p.subscription_status,
          });
        }
      }

      // Combinar profiles com pagamentos
      const usersWithPayments: UserWithPayment[] = (profiles as Profile[]).map((profile: Profile) => {
        const payment = paymentMap.get(profile.email.toLowerCase());
        return {
          id: profile.id,
          email: profile.email,
          telefone: profile.telefone,
          created_at: profile.created_at,
          is_paid: payment?.is_paid || false,
          subscription_status: payment?.subscription_status || null,
        };
      });

      // Aplicar filtro de pagamento client-side
      let filteredUsers = usersWithPayments;
      if (filter === "paid") {
        filteredUsers = usersWithPayments.filter(
          (u) => u.is_paid || ["active", "trialing"].includes(u.subscription_status?.toLowerCase() || "")
        );
      } else if (filter === "unpaid") {
        filteredUsers = usersWithPayments.filter(
          (u) => !u.is_paid && !["active", "trialing"].includes(u.subscription_status?.toLowerCase() || "")
        );
      }

      setUsers(filteredUsers);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchEmail, filter]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  // Alternar status de pagamento
  async function togglePaymentStatus(user: UserWithPayment) {
    const isPaidNow =
      user.is_paid || ["active", "trialing"].includes(user.subscription_status?.toLowerCase() || "");
    const newIsPaid = !isPaidNow;

    setActionLoading(user.id);
    try {
      const { error } = await supabase.rpc("admin_set_user_paid_status", {
        target_email: user.email,
        new_is_paid: newIsPaid,
      });

      if (error) {
        console.error("Erro ao atualizar status:", error);
        setToast({ type: "error", message: "Erro ao atualizar status de pagamento." });
        return;
      }

      setToast({
        type: "success",
        message: newIsPaid ? "Acesso liberado com sucesso!" : "Acesso revogado com sucesso!",
      });

      // Atualizar lista localmente
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                is_paid: newIsPaid,
                subscription_status: newIsPaid ? "active" : "canceled",
              }
            : u
        )
      );
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function isPaidOrActive(user: UserWithPayment) {
    return (
      user.is_paid || ["active", "trialing"].includes(user.subscription_status?.toLowerCase() || "")
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (checking) {
    return (
      <div className="space-y-6">
        <div
          className={`h-7 w-64 rounded-lg animate-pulse ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"
          }`}
        />
        <div
          className={`h-4 w-96 rounded animate-pulse ${
            theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"
          }`}
        />
        <div
          className={`h-64 rounded-3xl border ${cardBorder} ${cardBg} animate-pulse`}
        />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? theme === "dark"
                  ? "bg-emerald-900/20 border-emerald-800 text-emerald-200"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : theme === "dark"
                ? "bg-red-900/20 border-red-800 text-red-200"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Gestão de Usuários</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Gerencie leads, libere acessos e visualize usuários cadastrados.
        </p>
      </div>

      {/* Filtros e busca */}
      <div
        className={`rounded-2xl border p-4 ${cardBorder} ${cardBg}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Busca por email */}
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Buscar por email..."
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFilter("all");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                filter === "all"
                  ? theme === "dark"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-200 text-zinc-900"
                  : theme === "dark"
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFilter("paid");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                filter === "paid"
                  ? theme === "dark"
                    ? "bg-emerald-900/50 text-emerald-200"
                    : "bg-emerald-100 text-emerald-800"
                  : theme === "dark"
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              Pagos
            </button>
            <button
              onClick={() => {
                setFilter("unpaid");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                filter === "unpaid"
                  ? theme === "dark"
                    ? "bg-amber-900/50 text-amber-200"
                    : "bg-amber-100 text-amber-800"
                  : theme === "dark"
                  ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              Não pagos
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de usuários */}
      <div className={`rounded-2xl border overflow-hidden ${cardBorder} ${cardBg}`}>
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div
              className={`animate-spin h-8 w-8 border-2 rounded-full ${
                theme === "dark"
                  ? "border-zinc-700 border-t-emerald-500"
                  : "border-zinc-200 border-t-emerald-600"
              }`}
            />
          </div>
        ) : users.length === 0 ? (
          <div className={`p-8 text-center ${textSecondary}`}>
            Nenhum usuário encontrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`border-b ${tableBorder} ${
                      theme === "dark" ? "bg-zinc-900/60" : "bg-zinc-50"
                    }`}
                  >
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                    >
                      Email
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                    >
                      Telefone
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                    >
                      Cadastro
                    </th>
                    <th
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${textSecondary}`}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b ${tableBorder} ${tableRowHover} transition-colors`}
                    >
                      <td className={`px-4 py-3 ${textPrimary}`}>
                        <span className="text-sm font-medium">{user.email}</span>
                      </td>
                      <td className={`px-4 py-3 ${textSecondary}`}>
                        <span className="text-sm">{user.telefone || "-"}</span>
                      </td>
                      <td className={`px-4 py-3 ${textSecondary}`}>
                        <span className="text-sm">{formatDate(user.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => togglePaymentStatus(user)}
                          disabled={actionLoading === user.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isPaidOrActive(user)
                              ? theme === "dark"
                                ? "bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60"
                                : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : theme === "dark"
                              ? "bg-amber-900/40 text-amber-200 hover:bg-amber-900/60"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          }`}
                        >
                          {actionLoading === user.id
                            ? "..."
                            : isPaidOrActive(user)
                            ? "Pago"
                            : "Liberar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div
              className={`px-4 py-3 flex items-center justify-between border-t ${tableBorder}`}
            >
              <div className={`text-sm ${textSecondary}`}>
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    theme === "dark"
                      ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    theme === "dark"
                      ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Próximo →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
