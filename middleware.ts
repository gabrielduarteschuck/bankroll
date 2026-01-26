import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabaseServer";

// Whitelist de emails de administradores
// Configure via variável de ambiente ADMIN_EMAILS (separados por vírgula)
const getAdminEmails = (): string[] => {
  const adminEmailsEnv = process.env.ADMIN_EMAILS || "";
  const emailsFromEnv = adminEmailsEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  
  // Email hardcoded do admin principal
  const hardcodedAdmin = "duarte.schuck@icloud.com".toLowerCase();
  
  // Combina emails do .env com o email hardcoded
  return [...new Set([...emailsFromEnv, hardcodedAdmin])];
};

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const res = NextResponse.next();

  // Permite a página de recovery mesmo com sessão ativa (não aplicar redirects aqui)
  if (pathname === "/reset-password") {
    return res;
  }

  // Cria cliente Supabase para validar sessão real
  const supabase = createSupabaseMiddlewareClient(req, res);

  // Valida a sessão do usuário (atualiza tokens se necessário)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;

  // 0) Se o Supabase cair no "/" durante recovery (type=recovery na query),
  // redireciona para /reset-password preservando a query.
  if (pathname === "/" && req.nextUrl.searchParams.get("type") === "recovery") {
    const url = req.nextUrl.clone();
    url.pathname = "/reset-password";
    return NextResponse.redirect(url);
  }

  // 1) Protege /dashboard: sem login → redireciona para /login
  if (pathname.startsWith("/dashboard") && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 1.1) Dashboard agora é FREEMIUM - não redireciona mais pro checkout
  // Apenas verifica onboarding para todos os usuários logados
  if (pathname.startsWith("/dashboard") && isLoggedIn) {
    try {
      const { data: onboardingData, error: onboardingErr } = await supabase.rpc("get_onboarding_status");

      if (!onboardingErr && onboardingData) {
        const status = Array.isArray(onboardingData) ? onboardingData[0] : onboardingData;

        if (status && status.onboarding_completed === false) {
          // Redireciona para o passo correto do onboarding
          if (!status.has_banca) {
            return NextResponse.redirect(new URL("/onboarding/banca", req.nextUrl.origin));
          }
          if (!status.has_entrada) {
            return NextResponse.redirect(new URL("/onboarding/entrada", req.nextUrl.origin));
          }
          // Tem tudo mas não marcou completo - vai pro final
          return NextResponse.redirect(new URL("/onboarding/final", req.nextUrl.origin));
        }
      }
    } catch {
      // se RPC não existir ainda, não bloqueia
    }
  }

  // 1.2) Protege /onboarding: requer apenas login (não mais pagamento)
  if (pathname.startsWith("/onboarding") && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 2) Protege /admin: requer login + email na whitelist
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      // Sem login → redireciona para login
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    // Verifica se o email está na whitelist de admins
    const adminEmails = getAdminEmails();
    const userEmail = user?.email?.toLowerCase();

    if (!userEmail || !adminEmails.includes(userEmail)) {
      // Não é admin → redireciona para /dashboard
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // 3) Se já estiver logado e tentar acessar / → manda pro /dashboard
  // Agora: "/" é público (VSL). Só tratamos recovery.
  if (pathname === "/") {
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding/:path*", "/reset-password", "/"],
};
