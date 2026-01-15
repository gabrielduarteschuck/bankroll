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
  const router = useRouter();

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:17',message:'handleLogin entry',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:27',message:'signInWithPassword result',data:{hasError:!!error,hasSession:!!data?.session,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:30',message:'login error branch',data:{errorMessage:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        setError(error.message);
        setLoading(false);
        return;
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:35',message:'login success - before redirect',data:{hasSession:!!data?.session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Aguarda um pouco para garantir que os cookies sejam salvos
      await new Promise((resolve) => setTimeout(resolve, 200));

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:42',message:'login catch block',data:{errorMessage:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
      setLoading(false);
    }
  }

  async function handleSignUp(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:40',message:'handleSignUp entry',data:{email,isSignUp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Timeout de segurança para garantir que o loading sempre pare
    const timeoutId = setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:47',message:'signup timeout triggered',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
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
        setError(
          networkError.message?.includes("fetch") || networkError.message?.includes("Failed") || networkError.message?.includes("Timeout")
            ? "Erro de conexão. Verifique sua internet e tente novamente."
            : networkError.message || "Erro ao criar conta. Tente novamente."
        );
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = signUpResult;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:131',message:'signup result received',data:{hasUser:!!data?.user,hasError:!!signUpError,hasSession:!!data?.session,errorMessage:signUpError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion

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
        if (signUpError.message?.includes("fetch") || signUpError.message?.includes("Failed")) {
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:176',message:'user created without session - attempting auto login',data:{hasUser:true,hasSession:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.log("✅ Usuário criado mas sem sessão - tentando fazer login automático");
        try {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:184',message:'auto login attempt result',data:{hasError:!!signInError,hasSession:!!signInData?.session,errorMessage:signInError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          
          if (!signInError && signInData?.session) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:187',message:'auto login success - redirecting',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            console.log("✅ Login automático bem-sucedido - redirecionando");
            router.push("/dashboard");
            router.refresh();
            return;
          }
        } catch (loginErr: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:193',message:'auto login catch error',data:{errorMessage:loginErr?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          console.error("Erro ao tentar login automático:", loginErr);
        }
        
        // Se login automático falhou, volta para tela de login
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:197',message:'switching to login view',data:{email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aa58c2b-f3f9-4f8d-91bd-6293b6e31719',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'login/page.tsx:258',message:'signup finally block',data:{loading},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      // Garantia final: sempre limpa o timeout
      clearTimeout(timeoutId);
      // REMOVIDO: setTimeout que causava race condition
      // O loading já é controlado em todos os pontos de saída
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-sm space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            {isSignUp ? "Criar Conta" : "Login"} – Dashboard NBA
          </h1>
          <p className="text-sm text-zinc-400">
            {isSignUp
              ? "Crie sua conta para começar"
              : "Entre com sua conta existente"}
          </p>
        </div>

        {/* Toggle entre Login e Sign Up */}
        <div className="flex gap-2 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setTelefone("");
              setConfirmPassword("");
            }}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              !isSignUp
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
              isSignUp
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Criar Conta
          </button>
        </div>

        <form
          onSubmit={isSignUp ? handleSignUp : handleLogin}
          className="space-y-4"
        >
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="Email"
            className="w-full p-3 rounded bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            name="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            placeholder="Senha"
            className="w-full p-3 rounded bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isSignUp ? 6 : undefined}
          />

          {isSignUp && (
            <>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirmar Senha"
                className="w-full p-3 rounded bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />

              <input
                type="tel"
                name="telefone"
                autoComplete="tel"
                placeholder="Número de Celular (ex: 11987654321)"
                className="w-full p-3 rounded bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white"
                value={telefone}
                onChange={(e) => {
                  // Permite apenas números e alguns caracteres de formatação
                  const value = e.target.value.replace(/[^\d()\s-]/g, "");
                  setTelefone(value);
                }}
                required
              />
              <p className="text-xs text-zinc-500">
                Digite apenas números (ex: 11987654321)
              </p>

              <p className="text-xs text-zinc-500">
                A senha deve ter pelo menos 6 caracteres
              </p>
            </>
          )}

          {error && (
            <div className="p-3 rounded bg-red-900/20 border border-red-500/50">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 rounded bg-white text-black font-semibold hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? isSignUp
                ? "Criando conta..."
                : "Entrando..."
              : isSignUp
              ? "Criar Conta"
              : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
