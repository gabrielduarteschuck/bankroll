import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase para uso no browser
 * Usa auth-helpers para gerenciar cookies corretamente
 * O auth-helpers gerencia automaticamente a persistência da sessão
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
