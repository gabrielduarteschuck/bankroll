"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/9B6aEW637aPiaWPd5AaMU00";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Celular (Brasil): salva internamente só números (11 dígitos) e persiste em E.164 (+55XXXXXXXXXXX)
  const [phoneDigits, setPhoneDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const checkoutUrl = useMemo(() => {
    const envUrl = String(process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_URL || "").trim();
    return envUrl || STRIPE_CHECKOUT_URL;
  }, []);

  // Mensagens via query params (Supabase /login?error=... e /login?reset=1)
  useEffect(() => {
    function safeDecode(v: string): string {
      try {
        return decodeURIComponent(v.replace(/\+/g, " "));
      } catch {
        // Se vier % malformado (URIError), mantém o valor cru
        return v;
      }
    }

    function parseQueryRaw(search: string): Record<string, string> {
      const out: Record<string, string> = {};
      const s = String(search || "").replace(/^\?/, "");
      if (!s) return out;
      for (const part of s.split("&")) {
        if (!part) continue;
        const idx = part.indexOf("=");
        const k = idx >= 0 ? part.slice(0, idx) : part;
        const v = idx >= 0 ? part.slice(idx + 1) : "";
        const key = safeDecode(k);
        if (!key) continue;
        out[key] = safeDecode(v);
      }
      return out;
    }

    const qs = parseQueryRaw(window.location.search);

    // 1) Pós-reset de senha
    if (qs.reset === "1") {
      setSuccess("Senha alterada com sucesso! Faça login novamente.");
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // noop
      }
      return;
    }

    // 2) Erros do Supabase (ex: otp_expired)
    if (qs.error === "access_denied" || qs.error_code === "otp_expired") {
      setError("Link expirado, solicite novamente.");
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // noop
      }
      return;
    }
  }, []);

  function formatBRPhone(digits: string): string {
    const d = digits.replace(/\D/g, "").slice(0, 11); // trava em 11
    if (!d) return "";
    if (d.length <= 2) return `(${d}`;
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    // padrão: (DD) 9XXXX-XXXX
    if (rest.length <= 5) return `(${ddd}) ${rest}`;
    const part1 = rest.slice(0, 5);
    const part2 = rest.slice(5, 9);
    return `(${ddd}) ${part1}${part2 ? `-${part2}` : ""}`;
  }

  function phoneE164OrNull(): string | null {
    const d = phoneDigits.replace(/\D/g, "").slice(0, 11);
    if (d.length !== 11) return null;
    return `+55${d}`;
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!email.trim()) {
        setError("Informe seu email.");
        setLoading(false);
        return;
      }
      if (!password.trim()) {
        setError("Informe sua senha.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Aguarda um pouco para garantir que os cookies sejam salvos
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Checa pagamento (best-effort). Se não estiver pago, manda para o checkout.
      try {
        const { data: paid, error: paidErr } = await supabase.rpc("has_paid_access");
        if (!paidErr && paid !== true) {
          setSuccess("Para acessar, finalize o pagamento. Redirecionando...");
          try {
            window.location.assign(checkoutUrl);
          } catch {
            window.location.href = checkoutUrl;
          }
          return;
        }
      } catch {
        // se RPC não existir ainda, mantém fluxo normal
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }

  async function handleForgotPassword(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!email.trim()) {
        setError("Informe seu email.");
        setLoading(false);
        return;
      }

      const defaultAppUrl =
        process.env.NODE_ENV === "production"
          ? "https://prostake.app"
          : "http://localhost:3000";
      const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || defaultAppUrl)
        .trim()
        .replace(/\/$/, "");
      const redirectTo = `${appUrl}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      // Evita enumeração de usuário: mensagem genérica
      if (error) {
        console.log("resetPasswordForEmail error:", error);
      }

      setSuccess(
        "Se este email estiver cadastrado, enviaremos um link para redefinir sua senha."
      );
    } catch {
      setSuccess(
        "Se este email estiver cadastrado, enviaremos um link para redefinir sua senha."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Timeout de segurança para garantir que o loading sempre pare
    const timeoutId = setTimeout(() => {
      console.error("Timeout no signup - forçando parada do loading");
      setError("Tempo limite excedido. Verifique sua conexão e tente novamente.");
      setLoading(false);
    }, 10000); // 10 segundos (reduzido de 15)

    try {
      // Validações
      if (!fullName.trim()) {
        clearTimeout(timeoutId);
        setError("Informe seu nome.");
        setLoading(false);
        return;
      }

      if (!email.trim()) {
        clearTimeout(timeoutId);
        setError("Informe seu email.");
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        clearTimeout(timeoutId);
        setError("Informe uma senha.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        clearTimeout(timeoutId);
        setError("A senha deve ter pelo menos 6 caracteres");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        clearTimeout(timeoutId);
        setError("As senhas não coincidem");
        setLoading(false);
        return;
      }

      // Celular é obrigatório (Brasil): DDD + 9 dígitos (11 no total)
      const digits = phoneDigits.replace(/\D/g, "").slice(0, 11);
      const phoneE164 = phoneE164OrNull();
      if (!digits) {
        clearTimeout(timeoutId);
        setError("Informe seu número de celular.");
        setLoading(false);
        return;
      }
      if (digits.length !== 11) {
        clearTimeout(timeoutId);
        setError("Número inválido. Use DDD + 9 dígitos (ex: 51 9XXXX-XXXX)");
        setLoading(false);
        return;
      }

      // Verifica se o Supabase está configurado
      if (!supabase) {
        clearTimeout(timeoutId);
        setError("Erro: Cliente Supabase não configurado. Verifique as variáveis de ambiente.");
        setLoading(false);
        return;
      }

      const phone = phoneE164OrNull();
      clearTimeout(timeoutId);

      // Cria a conta no Supabase (sem fluxo de verificação de email)
      let signUpResult: any;
      try {
        signUpResult = await Promise.race([
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                ...(phone ? { phone, telefone: phone } : {}),
                nome: fullName.trim(),
              },
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: Supabase não respondeu em 8 segundos")), 8000)
          ),
        ]);
      } catch (networkError: any) {
        clearTimeout(timeoutId);
        const rawMsg = String(networkError?.message || "");
        const isTimeout = rawMsg.toLowerCase().includes("timeout");
        const isFetchFail =
          rawMsg.toLowerCase().includes("failed") || rawMsg.toLowerCase().includes("fetch");
        setError(
          isTimeout
            ? "O Supabase demorou para responder. Tente novamente em alguns instantes."
            : isFetchFail
              ? "Erro de conexão. Verifique sua internet e tente novamente."
              : rawMsg || "Erro ao criar conta. Tente novamente."
        );
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = signUpResult as any;
      if (signUpError) {
        clearTimeout(timeoutId);
        setError(signUpError.message || "Erro ao criar conta.");
        setLoading(false);
        return;
      }

      // Conta criada -> manda direto para o checkout (sem depender de sessão/login)
      setSuccess("Conta criada com sucesso! Redirecionando para o pagamento...");
      try {
        window.location.assign(checkoutUrl);
      } catch {
        window.location.href = checkoutUrl;
      }
      return;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("❌ Erro inesperado no signup:", err);
      console.error("Stack trace:", err.stack);
      setError(
        err.message || 
        "Erro ao criar conta. Verifique sua conexão com a internet e tente novamente."
      );
      setLoading(false);
    } finally {
      // Garantia final: sempre limpa o timeout
      clearTimeout(timeoutId);
      // REMOVIDO: setTimeout que causava race condition
      // O loading já é controlado em todos os pontos de saída
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0.06),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(34,197,94,0.10),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_rgba(59,130,246,0.10),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-6 sm:py-8">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-8">
            {/* header */}
            <div className="flex flex-col items-center gap-2 text-center sm:gap-3">
              <div className="relative -mt-2 w-full max-w-2xl h-56 sm:h-[22rem]">
                <img
                  src="/imagens/logo%20prostake%20fundo%20transparemte.png"
                  alt="ProStake"
                  className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain scale-[1.55] sm:scale-[1.65]"
                />
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {isSignUp ? "Criar Conta" : "Login"}
                </h1>
                <p className="text-base text-zinc-600">
                  {isSignUp ? (
                    <>
                      Já tem uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(false);
                          setIsForgotPassword(false);
                          setError(null);
                          setSuccess(null);
                          setFullName("");
                          setPhoneDigits("");
                          setConfirmPassword("");
                        }}
                        className="cursor-pointer font-semibold text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
                      >
                        Entrar
                      </button>
                      .
                    </>
                  ) : (
                    <>
                      Não tem uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(true);
                          setIsForgotPassword(false);
                          setError(null);
                          setSuccess(null);
                          setFullName("");
                        }}
                        className="cursor-pointer font-semibold text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
                      >
                        Criar conta
                      </button>
                      .
                    </>
                  )}
                </p>
              </div>
            </div>

            <form
              onSubmit={
                isForgotPassword ? handleForgotPassword : isSignUp ? handleSignUp : handleLogin
              }
              className="mt-8 space-y-6"
            >
              {isSignUp && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-600">Nome</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-600">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="seuemail@exemplo.com"
                    className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none ring-0 transition focus:border-zinc-400"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-600">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete={isSignUp ? "new-password" : "current-password"}
                      placeholder="********"
                      className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 pr-12 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M12 5c-5.5 0-9.6 4.2-10.8 6 .9 1.3 4.9 8 10.8 8 5.9 0 9.9-6.7 10.8-8C21.6 9.2 17.5 5 12 5Zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                        />
                      </svg>
                    </button>
                  </div>

                  {!isSignUp && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError(null);
                          setSuccess(null);
                          setPassword("");
                        }}
                        className="cursor-pointer text-sm font-semibold text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isSignUp && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-600">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="********"
                        className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 pr-12 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                        aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                          <path
                            fill="currentColor"
                            d="M12 5c-5.5 0-9.6 4.2-10.8 6 .9 1.3 4.9 8 10.8 8 5.9 0 9.9-6.7 10.8-8C21.6 9.2 17.5 5 12 5Zm0 12c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500">
                      A senha deve ter pelo menos 6 caracteres.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-600">
                      Celular (Brasil)
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      inputMode="numeric"
                      placeholder="(51) 9XXXX-XXXX"
                      className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-4 text-zinc-900 placeholder-zinc-400 shadow-inner outline-none transition focus:border-zinc-400"
                      value={formatBRPhone(phoneDigits)}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setPhoneDigits(digitsOnly); // trava em 11 e aceita só números
                      }}
                    />
                  </div>
                </div>
              )}

              {isForgotPassword && (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-sm text-zinc-700">
                    Informe seu email e enviaremos um link para redefinir sua senha.
                  </p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError(null);
                        setSuccess(null);
                      }}
                      className="cursor-pointer text-sm font-semibold text-zinc-900 underline underline-offset-4 hover:text-zinc-700"
                    >
                      Voltar para o login
                    </button>
                  </div>
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-zinc-900 px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? isForgotPassword
                    ? "Enviando..."
                    : isSignUp
                      ? "Criando conta..."
                      : "Entrando..."
                  : isForgotPassword
                    ? "Enviar link de redefinição"
                    : isSignUp
                      ? "Criar Conta"
                      : "Entrar"}
              </button>

              <p className="pt-2 text-center text-sm text-zinc-500">
                Ao continuar, você concorda com nossos{" "}
                <span className="underline underline-offset-4">Termos</span>,{" "}
                <span className="underline underline-offset-4">Uso Aceitável</span>{" "}
                e <span className="underline underline-offset-4">Política de Privacidade</span>.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
