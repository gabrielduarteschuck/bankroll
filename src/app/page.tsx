"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Verifica se o usuário está logado
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Se estiver logado, redireciona para dashboard
        router.push("/dashboard");
      } else {
        // Se não estiver logado, redireciona para login
        router.push("/login");
      }
    }

    checkAuth();
  }, [router]);

  // Mostra loading enquanto verifica
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    </div>
  );
}
