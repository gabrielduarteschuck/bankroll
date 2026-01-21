"use client";

import { useTheme } from "@/contexts/ThemeContext";

type Tip = {
  title: string;
  body: string;
};

const TIPS: Tip[] = [
  {
    title: "Comece pequeno",
    body: "No início, use stakes menores para aprender o fluxo e entender como suas decisões impactam o resultado sem expor sua banca a variações grandes.",
  },
  {
    title: "Defina uma gestão de banca",
    body: "Estabeleça uma regra simples (ex: 1% a 3% por entrada) e siga consistentemente; isso reduz o risco de ruína e melhora sua consistência no longo prazo.",
  },
  {
    title: "Registre tudo",
    body: "Anote mercado, odd, unidades e resultado em cada entrada — dados completos facilitam identificar padrões, corrigir erros e evoluir sua estratégia com clareza.",
  },
  {
    title: "Evite decisões por impulso",
    body: "Se uma aposta parecer ‘boa demais’, pare e revise: motivo, contexto e valor da odd; a disciplina costuma valer mais do que a pressa.",
  },
  {
    title: "Foque em consistência, não em recuperar",
    body: "Após uma sequência ruim, não aumente unidades para ‘buscar o prejuízo’; mantenha sua estratégia e ajuste somente com base em análise, não em emoção.",
  },
  {
    title: "Revise semanalmente",
    body: "Reserve um momento na semana para olhar suas métricas e entradas; pequenas correções frequentes tendem a melhorar muito sua performance ao longo do tempo.",
  },
];

export default function DicasParaIniciantesPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>
          Dicas para Iniciantes
        </h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Recomendações práticas para começar com mais segurança e consistência.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TIPS.map((tip) => (
          <div
            key={tip.title}
            className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}
          >
            <h2 className={`text-base font-semibold ${textPrimary}`}>
              {tip.title}
            </h2>
            <p className={`mt-2 text-sm ${textSecondary}`}>{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

