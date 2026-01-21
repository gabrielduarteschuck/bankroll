/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente Supabase para uso em Server Actions
 * Usa cookies do Next.js para manter a sessão
 * 
 * SOLUÇÃO: No Next.js 16, ReadonlyRequestCookies não tem getAll()
 * Usamos headers() para obter cookies do Cookie header HTTP
 */
export async function createSupabaseServerActionClient() {
  const cookieStore = await cookies();
  const headersList = await headers();
  
  // Helper para obter todos os cookies do Supabase
  // Usa headers() para parse do Cookie header
  const getAllCookies = () => {
    try {
      // Tenta usar getAll() se disponível (pode não estar no Next.js 16)
      if ('getAll' in cookieStore && typeof (cookieStore as any).getAll === 'function') {
        const all = (cookieStore as any).getAll();
        if (Array.isArray(all)) {
          return all;
        }
      }
    } catch (error) {
      // getAll não existe, usa fallback
    }
    
    // Fallback: Parse do Cookie header HTTP
    const cookiesArray: { name: string; value: string }[] = [];
    
    try {
      const cookieHeader = headersList.get('cookie');
      if (cookieHeader) {
        // Parse do Cookie header: "name1=value1; name2=value2"
        cookieHeader.split(';').forEach((cookieStr) => {
          const trimmed = cookieStr.trim();
          const equalIndex = trimmed.indexOf('=');
          if (equalIndex > 0) {
            const name = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();
            if (name && value) {
              cookiesArray.push({ name, value });
            }
          }
        });
      }
    } catch (error) {
      console.error('Erro ao parse cookies do header:', error);
    }
    
    return cookiesArray;
  };
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return getAllCookies();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          // Em Server Actions, setAll pode não funcionar
          // O Supabase gerencia os cookies automaticamente
        }
      },
    },
  });
}
