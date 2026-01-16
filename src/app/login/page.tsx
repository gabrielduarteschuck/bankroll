"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // Celular (Brasil): salva internamente só números (11 dígitos) e persiste em E.164 (+55XXXXXXXXXXX)
  const [phoneDigits, setPhoneDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

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

      // Cria a conta no Supabase
      const redirectTo = `${window.location.origin}/dashboard`;

      // DEBUG (temporário): variáveis de ambiente públicas
      console.log("SUPABASE URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log("SUPABASE KEY EXISTS", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

      // DEBUG (temporário): input do signup
      const phone = phoneE164OrNull();
      console.log("SIGNUP INPUT", { email, password, phone, fullName });

      console.log("🚀 Iniciando signup...", {
        email,
        phone,
        redirectTo,
      });
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
                // Importante: telefone NÃO vai como campo principal; apenas metadata.
                ...(phone ? { phone, telefone: phone } : {}),
                nome: fullName.trim(),
              },
              emailRedirectTo: redirectTo,
            },
          }),
          // Timeout de 8 segundos para a chamada do Supabase
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout: Supabase não respondeu em 8 segundos")), 8000)
          )
        ]) as any;
        
        const duration = Date.now() - startTime;
        console.log(`✅ Signup completado em ${duration}ms`);
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

      // Logs explícitos para debug em produção (browser console)
      console.log("SIGNUP DATA", data);
      console.log("SIGNUP ERROR", signUpError);

      if (signUpError) {
        clearTimeout(timeoutId);
        console.error("Erro no signup:", signUpError);

        // Exibe a mensagem exatamente como vem do Supabase (sem tradução/normalização)
        setError(signUpError.message || "Erro no signup (sem mensagem).");
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
        setSuccess(
          "Conta criada com sucesso! Enviamos um email de confirmação. Após confirmar, volte aqui e faça login."
        );
        setIsSignUp(false);
        setFullName("");
        setPassword("");
        setConfirmPassword("");
        setPhoneDigits("");
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
      setSuccess(
        "Conta criada com sucesso! Enviamos um email de confirmação. Após confirmar, volte aqui e faça login."
      );
        setIsSignUp(false);
      setFullName("");
        setPassword("");
        setConfirmPassword("");
      setPhoneDigits("");
        setError(null);
        setLoading(false);
        // Email já está preenchido, usuário só precisa digitar a senha
        return;
      }
      
      // Fallback: se chegou aqui, algo inesperado aconteceu
      console.warn("⚠️ Signup sem usuário retornado e sem erro claro");
      console.warn("Dados completos:", { data, signUpError });
      // Volta para tela de login mesmo assim
      setSuccess(
        "Conta criada. Se sua confirmação por email estiver ativa, verifique sua caixa de entrada e spam."
      );
      setIsSignUp(false);
      setFullName("");
      setPassword("");
      setConfirmPassword("");
      setPhoneDigits("");
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
              <div className="relative -mt-2 w-full max-w-2xl h-28 sm:h-44">
                <img
                  src="/imagens/logo%20prostake%20fundo%20transparemte.png"
                  alt="ProStake"
                  className="absolute inset-0 h-full w-full object-contain scale-[1.55] sm:scale-[1.65]"
                />
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
                          setSuccess(null);
                          setFullName("");
                          setPhoneDigits("");
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
                          setSuccess(null);
                          setFullName("");
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

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="mt-8 space-y-6">
              {isSignUp && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/70">Nome</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              )}

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
                    <label className="text-sm font-medium text-white/70">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        autoComplete="new-password"
                        placeholder="********"
                        className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 pr-12 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                    <p className="text-xs text-white/40">
                      A senha deve ter pelo menos 6 caracteres.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/70">
                      Celular (Brasil)
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      inputMode="numeric"
                      placeholder="(51) 9XXXX-XXXX"
                      className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white placeholder-white/30 shadow-inner outline-none transition focus:border-white/20 focus:bg-black/40"
                      value={formatBRPhone(phoneDigits)}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setPhoneDigits(digitsOnly); // trava em 11 e aceita só números
                      }}
                    />
                  </div>
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3">
                  <p className="text-sm text-green-100">{success}</p>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
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
