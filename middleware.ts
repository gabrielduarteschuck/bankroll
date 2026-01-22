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
  // Se não estiver logado e tentar acessar / → manda pro /login
  if (pathname === "/") {
    if (req.nextUrl.searchParams.get("type") === "recovery") {
      return res;
    }
    const url = req.nextUrl.clone();
    url.pathname = isLoggedIn ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/reset-password", "/"],
};
