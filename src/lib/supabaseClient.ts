import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Flag para verificar se Supabase está configurado
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Cliente Supabase - só cria se as variáveis estiverem definidas
// Caso contrário, cria um cliente "dummy" que não faz nada
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

if (isSupabaseConfigured) {
  supabaseInstance = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}

// Proxy que permite usar supabase sem quebrar se não estiver configurado
// Retorna dados vazios/null em vez de quebrar
const supabaseProxy = {
  auth: {
    getUser: async () => {
      if (!supabaseInstance) {
        console.warn("[Supabase] Não configurado - getUser retornando null");
        return { data: { user: null }, error: null };
      }
      return supabaseInstance.auth.getUser();
    },
    getSession: async () => {
      if (!supabaseInstance) {
        console.warn("[Supabase] Não configurado - getSession retornando null");
        return { data: { session: null }, error: null };
      }
      return supabaseInstance.auth.getSession();
    },
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      if (!supabaseInstance) {
        return { data: { user: null, session: null }, error: { message: "Supabase não configurado" } };
      }
      return supabaseInstance.auth.signInWithPassword(credentials);
    },
    signUp: async (credentials: { email: string; password: string; options?: any }) => {
      if (!supabaseInstance) {
        return { data: { user: null, session: null }, error: { message: "Supabase não configurado" } };
      }
      return supabaseInstance.auth.signUp(credentials);
    },
    signOut: async () => {
      if (!supabaseInstance) {
        return { error: null };
      }
      return supabaseInstance.auth.signOut();
    },
    resetPasswordForEmail: async (email: string, options?: any) => {
      if (!supabaseInstance) {
        return { data: {}, error: { message: "Supabase não configurado" } };
      }
      return supabaseInstance.auth.resetPasswordForEmail(email, options);
    },
    onAuthStateChange: (callback: any) => {
      if (!supabaseInstance) {
        return { data: { subscription: { unsubscribe: () => {} } } };
      }
      return supabaseInstance.auth.onAuthStateChange(callback);
    },
  },
  from: (table: string) => {
    if (!supabaseInstance) {
      console.warn(`[Supabase] Não configurado - query em "${table}" retornando vazio`);
      // Retorna um builder que não faz nada
      const emptyBuilder: any = {
        select: () => emptyBuilder,
        insert: () => emptyBuilder,
        update: () => emptyBuilder,
        delete: () => emptyBuilder,
        upsert: () => emptyBuilder,
        eq: () => emptyBuilder,
        neq: () => emptyBuilder,
        gt: () => emptyBuilder,
        gte: () => emptyBuilder,
        lt: () => emptyBuilder,
        lte: () => emptyBuilder,
        like: () => emptyBuilder,
        ilike: () => emptyBuilder,
        is: () => emptyBuilder,
        in: () => emptyBuilder,
        contains: () => emptyBuilder,
        containedBy: () => emptyBuilder,
        order: () => emptyBuilder,
        limit: () => emptyBuilder,
        range: () => emptyBuilder,
        single: () => emptyBuilder,
        maybeSingle: () => emptyBuilder,
        then: (resolve: any) => resolve({ data: null, error: { message: "Supabase não configurado" } }),
      };
      return emptyBuilder;
    }
    return supabaseInstance.from(table);
  },
  rpc: (fn: string, params?: any) => {
    if (!supabaseInstance) {
      console.warn(`[Supabase] Não configurado - rpc "${fn}" retornando null`);
      return Promise.resolve({ data: null, error: { message: "Supabase não configurado" } });
    }
    return supabaseInstance.rpc(fn, params);
  },
  storage: {
    from: (bucket: string) => {
      if (!supabaseInstance) {
        return {
          upload: async () => ({ data: null, error: { message: "Supabase não configurado" } }),
          download: async () => ({ data: null, error: { message: "Supabase não configurado" } }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
          remove: async () => ({ data: null, error: { message: "Supabase não configurado" } }),
          list: async () => ({ data: null, error: { message: "Supabase não configurado" } }),
        };
      }
      return supabaseInstance.storage.from(bucket);
    },
  },
};

/**
 * Cliente Supabase para uso no browser
 * - Se as variáveis de ambiente estiverem configuradas, usa o cliente real
 * - Caso contrário, usa um proxy que retorna dados vazios sem quebrar
 */
export const supabase = supabaseProxy as unknown as ReturnType<typeof createBrowserClient>;

/**
 * Acesso direto ao cliente real (pode ser null se não configurado)
 * Use apenas quando precisar de funcionalidades não cobertas pelo proxy
 */
export const supabaseReal = supabaseInstance;
