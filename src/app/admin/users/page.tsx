import { redirect } from "next/navigation";
import { createSupabaseServerPageClient } from "@/lib/supabaseServerPage";
import RoleButton from "./RoleButton";

type Profile = {
  id: string;
  email: string;
  role: "user" | "admin";
  created_at: string;
  email_verified: boolean;
  email_confirmed_at: string | null;
};

/**
 * Server Component para listar e gerenciar usuários
 * 
 * Segurança:
 * - Middleware já protege a rota /admin
 * - Verifica se usuário é admin no servidor
 * - Apenas admins podem ver esta página
 */
export default async function AdminUsersPage() {
  // 1. Criar cliente Supabase
  const supabase = await createSupabaseServerPageClient();

  // 2. Validar usuário autenticado
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  // 3. Verificar se o usuário atual é admin usando a função is_admin
  const { data: isAdminResult, error: isAdminError } = await supabase.rpc(
    "is_admin",
    { user_id: user.id }
  );

  if (isAdminError) {
    console.error("Erro ao verificar se é admin:", isAdminError);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Sessão ainda não ajustada
          </p>
        </div>
        <div className="rounded-xl border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Erro ao verificar permissões de administrador. Verifique sua sessão e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  // Verificar diretamente o profile do usuário para debug
  // Tenta buscar o próprio profile (pode ser bloqueado por RLS se não for admin)
  const { data: userProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .eq("id", user.id)
    .single();

  // Se não conseguiu buscar o profile, tenta usar RPC para verificar
  let directRoleCheck = null;
  if (profileError || !userProfile) {
    try {
      const { data: roleData } = await supabase.rpc('get_user_role', { user_id_param: user.id });
      directRoleCheck = roleData;
    } catch (err) {
      // RPC pode não existir, ignora
    }
  }

  if (!isAdminResult) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Sessão ainda não ajustada
          </p>
        </div>
        <div className="rounded-xl border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Você não tem permissão de administrador. Verifique se sua conta possui o role 'admin' na tabela profiles.
          </p>
          {userProfile && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Role atual: <strong className="text-yellow-800 dark:text-yellow-300">{userProfile.role || 'não definido'}</strong>
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Email: <strong className="text-yellow-800 dark:text-yellow-300">{userProfile.email}</strong>
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-3">
                <strong>Próximos passos:</strong>
              </p>
              <ol className="text-xs text-yellow-700 dark:text-yellow-400 list-decimal list-inside space-y-1 ml-2">
                <li>Execute o SQL no Supabase SQL Editor (arquivo DEFINIR-ADMIN.sql)</li>
                <li>Faça <strong>logout</strong> e <strong>login novamente</strong> para atualizar a sessão</li>
                <li>Tente acessar esta página novamente</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Buscar todos os perfis - usar query direta para pegar TODOS os perfis
  // incluindo os criados antes da função RPC existir
  const directQueryResult = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: false });
  
  let profiles: Profile[] = [];
  let profilesError = null;
  
  // Usar query direta como fonte principal
  if (directQueryResult.data && directQueryResult.data.length > 0) {
    // Tentar usar a função RPC para pegar email_verified (se disponível)
    let rpcProfiles: Profile[] = [];
    try {
      const rpcResult = await supabase.rpc("get_users_with_verification");
      if (rpcResult.data && rpcResult.data.length > 0) {
        rpcProfiles = rpcResult.data;
      }
    } catch (err) {
      // RPC não disponível ou erro, continuar sem ela
    }
    
    // Criar um mapa de email_verified da RPC para lookup rápido
    const emailVerifiedMap = new Map<string, { verified: boolean; confirmed_at: string | null }>();
    rpcProfiles.forEach((p: Profile) => {
      emailVerifiedMap.set(p.id, {
        verified: p.email_verified,
        confirmed_at: p.email_confirmed_at,
      });
    });
    
    // Mapear todos os perfis da query direta, usando dados da RPC se disponível
    profiles = directQueryResult.data.map((p: any) => {
      const rpcData = emailVerifiedMap.get(p.id);
      return {
        ...p,
        email_verified: rpcData?.verified || false,
        email_confirmed_at: rpcData?.confirmed_at || null,
      };
    });
  } else if (directQueryResult.error) {
    profilesError = directQueryResult.error;
  }

  if (profilesError) {
    console.error("Erro ao buscar perfis:", profilesError);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Erro ao carregar usuários
          </p>
        </div>
        <div className="rounded-xl border border-red-500 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {profilesError.message}
          </p>
          {profilesError.message?.includes("function") || profilesError.message?.includes("does not exist") ? (
            <p className="text-xs text-red-500 dark:text-red-400 mt-2">
              Execute a migration 0006_get_users_with_verification.sql no Supabase SQL Editor.
            </p>
          ) : null}
        </div>
      </div>
    );
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

  // Filtrar e separar usuários
  const validProfiles = (profiles || []).filter(
    (p: Profile) => p.email && p.email !== 'sem-email@exemplo.com'
  );
  
  const verifiedUsers = validProfiles.filter((p: Profile) => p.email_verified);
  const unverifiedUsers = validProfiles.filter((p: Profile) => !p.email_verified);

  function renderUserTable(userList: Profile[], title: string, badgeColor: string) {
    if (userList.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
            {userList.length} {userList.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Data de Criação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {userList.map((profile: Profile) => (
                  <tr
                    key={profile.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {profile.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {profile.email_verified ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-900/30 text-green-300 border border-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                          Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-yellow-900/30 text-yellow-300 border border-yellow-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400"></span>
                          Não Verificado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleButton
                        userId={profile.id}
                        currentRole={profile.role || "user"}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {formatDate(profile.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Gerenciar Usuários
        </h1>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-400">
          Lista de todos os usuários do sistema. Apenas administradores podem
          visualizar e gerenciar roles.
        </p>
      </div>

      {validProfiles.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
          <p className="text-gray-700 dark:text-gray-300">
            Nenhum usuário encontrado
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderUserTable(
            verifiedUsers,
            "✅ Usuários Verificados",
            "bg-green-900/30 text-green-300 border border-green-700"
          )}
          {renderUserTable(
            unverifiedUsers,
            "⏳ Usuários Não Verificados",
            "bg-yellow-900/30 text-yellow-300 border border-yellow-700"
          )}
        </div>
      )}

      {validProfiles.length > 0 && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Total: {validProfiles.length}{" "}
          {validProfiles.length === 1 ? "usuário" : "usuários"} ({verifiedUsers.length} verificados, {unverifiedUsers.length} não verificados)
        </div>
      )}
    </div>
  );
}
