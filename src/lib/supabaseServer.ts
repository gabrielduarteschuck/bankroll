import { createServerClient } from "@supabase/auth-helpers-nextjs";
import type { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase para uso no middleware
 * Usa o auth-helpers para gerenciar cookies corretamente
 */
export function createSupabaseMiddlewareClient(
  req: NextRequest,
  res: NextResponse
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (options) {
            res.cookies.set(name, value, options);
          } else {
            res.cookies.set(name, value);
          }
        });
      },
    },
  });
}
