"use server";

import { createSupabaseServerActionClient } from "@/lib/supabaseServerActions";
import { revalidatePath } from "next/cache";

type SyncResult = {
  success: boolean;
  syncedCount?: number;
  totalChecked?: number;
  errors?: string[];
  error?: string;
};

/**
 * Server Action para re-sincronizar perfis faltantes
 * Apenas admins podem executar
 */
export async function syncMissingProfiles(): Promise<SyncResult> {
  try {
    const supabase = await createSupabaseServerActionClient();

    // 1. Verificar se usuário está autenticado
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

    // 2. Verificar se usuário é admin usando função is_admin
    const { data: isAdminResult, error: isAdminError } = await supabase.rpc(
      "is_admin",
      { user_id: user.id }
    );

    if (isAdminError || !isAdminResult) {
      return {
        success: false,
        error: "Você não tem permissão de administrador",
      };
    }

    // 3. Chamar função RPC para sincronizar perfis faltantes
    const { data: syncResult, error: syncError } = await supabase.rpc(
      "sync_missing_profiles"
    );

    if (syncError) {
      console.error("Erro ao sincronizar perfis:", syncError);
      return {
        success: false,
        error: syncError.message || "Erro ao sincronizar perfis",
      };
    }

    // 4. Revalidar página admin para mostrar novos perfis
    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return {
      success: true,
      syncedCount: syncResult?.[0]?.synced_count || 0,
      totalChecked: syncResult?.[0]?.total_checked || 0,
      errors: syncResult?.[0]?.errors || [],
    };
  } catch (error: any) {
    console.error("Erro inesperado ao sincronizar perfis:", error);
    return {
      success: false,
      error: error.message || "Erro inesperado",
    };
  }
}
