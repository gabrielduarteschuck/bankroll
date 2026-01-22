"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function VslPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const [ctaHref, setCtaHref] = useState<string>("/login");
  const [checking, setChecking] = useState(true);

  const pricingExists = useMemo(() => false, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setChecking(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) return;
        if (user) {
          setCtaHref("/dashboard");
          return;
        }

        // Se um dia você criar /pricing, basta manter este fetch:
        // (hoje o projeto não tem /pricing, então cai no /login)
        try {
          const res = await fetch("/pricing", { method: "HEAD", cache: "no-store" });
          if (!cancelled && res.ok) {
            setCtaHref("/pricing");
            return;
          }
        } catch {
          // ignora
        }

        if (!cancelled) setCtaHref(pricingExists ? "/pricing" : "/login");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pricingExists]);

  const bg = theme === "dark" ? "bg-zinc-950 text-white" : "bg-white text-zinc-900";
  const muted = theme === "dark" ? "text-zinc-300" : "text-zinc-600";
  const border = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const card = theme === "dark" ? "bg-zinc-900/40" : "bg-zinc-50";

  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* Topo */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ProStake" className="h-9 w-9" />
            <div className="flex flex-col">
              <div className="text-sm font-semibold leading-tight">ProStake</div>
              <div className={`text-xs ${muted}`}>Gestão de banca e performance</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={`hidden sm:inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                theme === "dark"
                  ? "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              }`}
            >
              Entrar
            </Link>
            <button
              type="button"
              onClick={() => router.push(ctaHref)}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                theme === "dark"
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
              disabled={checking}
            >
              {checking ? "Carregando..." : "Começar agora"}
            </button>
          </div>
        </header>

        {/* Hero */}
        <section className="mt-10 grid grid-cols-1 gap-8 lg:gap-10">
          <div className="space-y-5 max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Controle sua banca e evolua com métricas claras.
            </h1>
            <p className={`text-base sm:text-lg ${muted}`}>
              Registre suas entradas, acompanhe seu histórico e enxergue desempenho real — sem planilhas.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => router.push(ctaHref)}
                className={`h-12 rounded-xl px-5 text-base font-semibold transition-colors ${
                  theme === "dark"
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
                disabled={checking}
              >
                {checking ? "Carregando..." : "Começar agora"}
              </button>
              <div className={`text-xs ${muted}`}>
                Sem compromisso. Você pode testar e cancelar quando quiser.
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${border} ${card}`}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-sm font-semibold">Gestão</div>
                  <div className={`mt-1 text-xs ${muted}`}>Banca, unidades e consistência.</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Histórico</div>
                  <div className={`mt-1 text-xs ${muted}`}>Tudo registrado e fácil de revisar.</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Métricas</div>
                  <div className={`mt-1 text-xs ${muted}`}>Relatórios objetivos e práticos.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bullets */}
        <section className="mt-12">
          <div className={`rounded-3xl border p-6 ${border} ${card}`}>
            <div className="text-lg font-semibold">O que o ProStake resolve</div>
            <ul className={`mt-4 space-y-3 text-sm ${muted}`}>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  ✓
                </span>
                <span><b className={theme === "dark" ? "text-white" : "text-zinc-900"}>Gestão de banca</b> com visão clara do seu saldo e evolução.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  ✓
                </span>
                <span><b className={theme === "dark" ? "text-white" : "text-zinc-900"}>Histórico completo</b> das suas entradas para aprender com o passado.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                  ✓
                </span>
                <span><b className={theme === "dark" ? "text-white" : "text-zinc-900"}>Métricas e relatórios</b> para decidir com base em dados, não em feeling.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mt-10">
          <div className="text-lg font-semibold">Como funciona</div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { n: "1", t: "Crie sua banca", d: "Defina sua banca inicial e a base de unidade." },
              { n: "2", t: "Registre entradas", d: "Salve suas apostas (simples ou múltiplas) em segundos." },
              { n: "3", t: "Acompanhe resultados", d: "Veja métricas e relatórios para evoluir com consistência." },
            ].map((step) => (
              <div key={step.n} className={`rounded-3xl border p-5 ${border} ${card}`}>
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-2xl flex items-center justify-center text-sm font-black ${
                    theme === "dark" ? "bg-zinc-900 text-white border border-zinc-800" : "bg-white text-zinc-900 border border-zinc-200"
                  }`}>
                    {step.n}
                  </div>
                  <div className="text-sm font-semibold">{step.t}</div>
                </div>
                <div className={`mt-3 text-sm ${muted}`}>{step.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Rodapé */}
        <footer className={`mt-14 border-t pt-8 ${border}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-xs ${muted}`}>© {new Date().getFullYear()} ProStake</div>
            <div className="flex items-center gap-4 text-xs">
              <a href="#" className={`${muted} hover:underline`}>Termos</a>
              <a href="#" className={`${muted} hover:underline`}>Privacidade</a>
              <a href="#" className={`${muted} hover:underline`}>Contato</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

