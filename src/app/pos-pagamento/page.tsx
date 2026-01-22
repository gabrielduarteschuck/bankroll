"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function PosPagamentoPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [status, setStatus] = useState<"checking" | "ok" | "not_logged" | "timeout">("checking");
  const [detail, setDetail] = useState<string>("Confirmando seu pagamento...");

  const ui = useMemo(() => {
    return theme === "dark"
      ? {
          bg: "bg-zinc-950 text-white",
          card: "bg-zinc-900/50 border-zinc-800",
          muted: "text-zinc-300",
          btn: "bg-emerald-600 text-white hover:bg-emerald-500",
          btn2: "bg-zinc-900 text-zinc-200 hover:bg-zinc-800 border border-zinc-800",
        }
      : {
          bg: "bg-white text-zinc-900",
          card: "bg-zinc-50 border-zinc-200",
          muted: "text-zinc-600",
          btn: "bg-emerald-600 text-white hover:bg-emerald-700",
          btn2: "bg-white text-zinc-900 hover:bg-zinc-50 border border-zinc-200",
        };
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 25; // ~25s

    async function run() {
      setStatus("checking");
      setDetail("Confirmando seu pagamento...");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        setStatus("not_logged");
        setDetail("Faça login para liberar seu acesso.");
        return;
      }

      async function checkPaidOnce(): Promise<boolean> {
        try {
          const { data: paid, error } = await supabase.rpc("has_paid_access");
          if (error) return false;
          return paid === true;
        } catch {
          return false;
        }
      }

      // primeiro check imediato
      if (await checkPaidOnce()) {
        if (cancelled) return;
        setStatus("ok");
        setDetail("Pagamento confirmado. Redirecionando...");
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      // polling curto (webhook pode demorar alguns segundos)
      const timer = setInterval(async () => {
        attempts += 1;
        const paid = await checkPaidOnce();
        if (cancelled) return;

        if (paid) {
          clearInterval(timer);
          setStatus("ok");
          setDetail("Pagamento confirmado. Redirecionando...");
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(timer);
          setStatus("timeout");
          setDetail(
            "Ainda não conseguimos confirmar o pagamento. Às vezes o Stripe demora alguns instantes. Tente novamente."
          );
        }
      }, 1000);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className={`min-h-screen ${ui.bg}`}>
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-10">
        <div className={`w-full rounded-3xl border p-6 shadow-sm ${ui.card}`}>
          <div className="text-lg font-semibold">Finalizando seu acesso</div>
          <div className={`mt-2 text-sm ${ui.muted}`}>{detail}</div>

          <div className="mt-6 flex flex-col gap-3">
            {status === "not_logged" && (
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className={`h-12 w-full rounded-2xl px-5 text-sm font-semibold transition-colors ${ui.btn}`}
              >
                Ir para o login
              </button>
            )}

            {status === "timeout" && (
              <>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className={`h-12 w-full rounded-2xl px-5 text-sm font-semibold transition-colors ${ui.btn}`}
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => router.replace("/dashboard")}
                  className={`h-12 w-full rounded-2xl px-5 text-sm font-semibold transition-colors ${ui.btn2}`}
                >
                  Ir para o dashboard
                </button>
              </>
            )}

            {status === "checking" && (
              <div className={`text-xs ${ui.muted}`}>
                Dica: se você acabou de pagar, pode levar alguns segundos até o webhook atualizar seu acesso.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

