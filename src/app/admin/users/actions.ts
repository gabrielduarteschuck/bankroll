"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerActionClient } from "@/lib/supabaseServerActions";

type UpdateRoleResult = {
  success: boolean;
  error?: string;
};

/**
 * Server Action para atualizar o role de um usuário
 * 
 * Validações:
 * - Usuário deve estar autenticado
 * - Usuário atual deve ser admin
 * - Role deve ser 'user' ou 'admin'
 * - userId deve ser válido
 */
export async function updateUserRole(
  userId: string,
  newRole: "user" | "admin"
): Promise<UpdateRoleResult> {
  try {
    // 1. Criar cliente Supabase
    const supabase = await createSupabaseServerActionClient();

    // 2. Validar usuário autenticado
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Usuário não autenticado",
      };
    }

    // 3. Verificar se o usuário atual é admin usando a função is_admin
    const { data: isAdminResult, error: isAdminError } = await supabase.rpc(
      "is_admin",
      { user_id: user.id }
    );

    if (isAdminError) {
      console.error("Erro ao verificar se é admin:", isAdminError);
      return {
        success: false,
        error: "Erro ao verificar permissões de administrador",
      };
    }

    if (!isAdminResult) {
      return {
        success: false,
        error: "Apenas administradores podem alterar roles de usuários",
      };
    }

    // 4. Validar newRole
    if (newRole !== "user" && newRole !== "admin") {
      return {
        success: false,
        error: "Role inválido. Deve ser 'user' ou 'admin'",
      };
    }

    // 5. Validar userId
    if (!userId || typeof userId !== "string") {
      return {
        success: false,
        error: "ID de usuário inválido",
      };
    }

    // 6. Verificar se o usuário alvo existe
    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (targetError || !targetProfile) {
      return {
        success: false,
        error: "Usuário não encontrado",
      };
    }

    // 7. Verificar se o role já é o desejado
    if (targetProfile.role === newRole) {
      return {
        success: false,
        error: `Usuário já possui o role '${newRole}'`,
      };
    }

    // 8. Atualizar o role
    // A policy RLS profiles_admin_update permite que admins atualizem qualquer profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateError) {
      console.error("Erro ao atualizar role:", updateError);
      return {
        success: false,
        error: `Erro ao atualizar role: ${updateError.message}`,
      };
    }

    // 9. Revalidar a rota /admin/users para atualizar a UI
    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Erro inesperado ao atualizar role:", error);
    return {
      success: false,
      error: `Erro inesperado: ${error.message || "Erro desconhecido"}`,
    };
  }
}
