"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "github">(null);
  const router = useRouter();

  async function handleOAuth(provider: "google" | "github") {
    try {
      setError(null);
      setOauthLoading(provider);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/dashboard`
              : undefined,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao iniciar login social. Tente novamente.");
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    try {
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

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    // Timeout de segurança para garantir que o loading sempre pare
    const timeoutId = setTimeout(() => {
      console.error("Timeout no signup - forçando parada do loading");
      setError("Tempo limite excedido. Verifique sua conexão e tente novamente.");
      setLoading(false);
    }, 10000); // 10 segundos (reduzido de 15)

    try {
      // Validações
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

      if (!telefone || telefone.trim() === "") {
        clearTimeout(timeoutId);
        setError("O número de celular é obrigatório");
        setLoading(false);
        return;
      }

      // Validação básica de telefone (formato simples)
      const telefoneLimpo = telefone.replace(/\D/g, ""); // Remove tudo que não é dígito
      if (telefoneLimpo.length < 10) {
        clearTimeout(timeoutId);
        setError("Número de celular inválido");
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

      // Cria a conta no Supabase
      console.log("🚀 Iniciando signup...", { email, telefoneLimpo });
      const startTime = Date.now();
      
      let signUpResult;
      try {
        console.log("📡 Chamando supabase.auth.signUp...");
        signUpResult = await Promise.race([
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                telefone: telefoneLimpo, // Salva telefone limpo nos metadados
              },
              emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
            },
          }),
          // Timeout de 8 segundos para a chamada do Supabase
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout: Supabase não respondeu em 8 segundos")), 8000)
          )
        ]) as any;
        
        const duration = Date.now() - startTime;
        console.log(`✅ Signup completado em ${duration}ms`, signUpResult);
      } catch (networkError: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.error(`❌ Erro de rede no signup após ${duration}ms:`, networkError);
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

      const { data, error: signUpError } = signUpResult;

      // Log para debug
      console.log("📊 Signup result:", { 
        hasUser: !!data?.user, 
        hasError: !!signUpError,
        error: signUpError,
        session: !!data?.session,
        user: data?.user ? { id: data.user.id, email: data.user.email } : null,
        fullData: data,
        fullError: signUpError
      });

      if (signUpError) {
        clearTimeout(timeoutId);
        console.error("Erro no signup:", signUpError);
        
        // Mensagens de erro mais amigáveis
        let errorMessage = signUpError.message;
        if (signUpError.message?.toLowerCase().includes("timeout")) {
          errorMessage = "O Supabase demorou para responder. Tente novamente em alguns instantes.";
        } else if (signUpError.message?.includes("fetch") || signUpError.message?.includes("Failed")) {
          errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
        } else if (signUpError.message?.includes("Database error")) {
          errorMessage = "Erro no banco de dados. Execute a migration 0005_fix_signup_trigger.sql no Supabase.";
        } else if (signUpError.message?.includes("User already registered")) {
          errorMessage = "Este email já está cadastrado. Tente fazer login.";
        }
        
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Se o signup foi bem-sucedido (sem erro)
      clearTimeout(timeoutId);
      
      // Se temos usuário e sessão, redireciona imediatamente
      if (data?.user && data?.session) {
        console.log("✅ Usuário criado com sessão ativa - redirecionando");
        router.push("/dashboard");
        router.refresh();
        return;
      }
      
      // Se temos usuário mas não temos sessão, tenta fazer login automaticamente
      // (pode funcionar se email confirmation estiver desabilitado)
      if (data?.user && !data?.session) {
        console.log("✅ Usuário criado mas sem sessão - tentando fazer login automático");
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (!signInError && signInData?.session) {
            console.log("✅ Login automático bem-sucedido - redirecionando");
            router.push("/dashboard");
            router.refresh();
            return;
          }
        } catch (loginErr: any) {
          console.error("Erro ao tentar login automático:", loginErr);
        }
        
        // Se login automático falhou, volta para tela de login
        console.log("✅ Conta criada - voltando para tela de login");
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
        setTelefone("");
        setError(null);
        setLoading(false);
        // Email já está preenchido, usuário só precisa digitar a senha
        return;
      }
      
      // Se não temos data.user mas também não temos erro, tenta fazer login
      // (usuário foi criado, mas Supabase não retornou data.user)
      if (!signUpError) {
        console.log("✅ Signup bem-sucedido - tentando fazer login automático");
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (!signInError && signInData?.session) {
            console.log("✅ Login automático bem-sucedido - redirecionando");
            router.push("/dashboard");
            router.refresh();
            return;
          }
        } catch (loginErr) {
          console.error("Erro ao tentar login automático:", loginErr);
        }
        
        // Se login automático falhou, volta para tela de login
        console.log("✅ Conta criada - voltando para tela de login");
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
        setTelefone("");
        setError(null);
        setLoading(false);
        // Email já está preenchido, usuário só precisa digitar a senha
        return;
      }
      
      // Fallback: se chegou aqui, algo inesperado aconteceu
      console.warn("⚠️ Signup sem usuário retornado e sem erro claro");
      console.warn("Dados completos:", { data, signUpError });
      // Volta para tela de login mesmo assim
      setIsSignUp(false);
      setPassword("");
      setConfirmPassword("");
      setTelefone("");
      setError(null);
      setLoading(false);
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
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.10),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_rgba(34,197,94,0.10),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_rgba(59,130,246,0.10),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
            {/* header */}
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <img src="/logo-mark.svg" alt="ProStake" className="h-10 w-10" />
              </div>
              <div className="flex justify-center">
                <img src="/logo.svg" alt="ProStake" className="h-12 w-auto sm:h-14" />
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  {isSignUp ? "Criar Conta" : "Login"}
                </h1>
                <p className="text-base text-white/70">
                  {isSignUp ? (
                    <>
                      Já tem uma conta?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(false);
                          setError(null);
                          setTelefone("");
                          setConfirmPassword("");
                        }}
                        className="cursor-pointer font-semibold text-white underline underline-offset-4 hover:opacity-90"
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
                          setError(null);
                        }}
                        className="cursor-pointer font-semibold text-white underline underline-offset-4 hover:opacity-90"
                      >
                        Criar conta
                      </button>
                      .
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* social */}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={!!oauthLoading || loading}
                className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M21.35 11.1H12v2.93h5.35c-.23 1.45-1.64 4.25-5.35 4.25-3.22 0-5.84-2.66-5.84-5.93s2.62-5.93 5.84-5.93c1.84 0 3.07.78 3.77 1.45l2.57-2.5C16.71 3.9 14.6 3 12 3 6.95 3 2.9 7.06 2.9 12.35S6.95 21.7 12 21.7c6.96 0 8.66-4.9 8.66-7.45 0-.5-.06-.87-.31-1.15Z"
                      />
                    </svg>
                  </span>
                  {oauthLoading === "google" ? "Conectando..." : "Login com Google"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuth("github")}
                disabled={!!oauthLoading || loading}
                className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="inline-flex items-center justify-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 .5A11.5 11.5 0 0 0 8.37 22.9c.57.1.78-.26.78-.57v-2.1c-3.17.7-3.84-1.38-3.84-1.38-.52-1.34-1.26-1.7-1.26-1.7-1.03-.72.08-.71.08-.71 1.14.08 1.74 1.19 1.74 1.19 1.01 1.76 2.65 1.25 3.3.96.1-.75.4-1.25.72-1.54-2.53-.29-5.2-1.3-5.2-5.77 0-1.27.44-2.31 1.17-3.12-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.14 1.19a10.7 10.7 0 0 1 2.86-.39c.97 0 1.94.13 2.86.39 2.18-1.5 3.14-1.19 3.14-1.19.62 1.59.23 2.76.11 3.05.73.81 1.17 1.85 1.17 3.12 0 4.49-2.68 5.48-5.23 5.76.41.36.78 1.08.78 2.18v3.24c0 .31.2.68.79.57A11.5 11.5 0 0 0 12 .5Z"
                      />
                    </svg>
                  </span>
                  {oauthLoading === "github" ? "Conectando..." : "Login com GitHub"}
                </span>
              </button>
            </div>

            {/* divider */}
            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <div className="text-sm text-white/50">ou</div>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="seuemail@exemplo.com"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white placeholder-white/30 shadow-inner outline-none ring-0 transition focus:border-white/20 focus:bg-black/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder="********"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 pr-12 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={isSignUp ? 6 : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
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
              </div>

              {isSignUp && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Confirmar senha</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="********"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 pr-12 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
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
                    <p className="text-xs text-white/40">A senha deve ter pelo menos 6 caracteres.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">Celular</label>
                    <input
                      type="tel"
                      name="telefone"
                      autoComplete="tel"
                      placeholder="(11) 98765-4321"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                      value={telefone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d()\s-]/g, "");
                        setTelefone(value);
                      }}
                      required
                    />
                    <p className="text-xs text-white/40">
                      Digite apenas números (ex: 11987654321).
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!oauthLoading}
                className="w-full rounded-2xl bg-white/10 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-black/40 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? isSignUp
                    ? "Criando conta..."
                    : "Entrando..."
                  : isSignUp
                    ? "Criar Conta"
                    : "Entrar"}
              </button>

              <p className="pt-2 text-center text-sm text-white/50">
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
