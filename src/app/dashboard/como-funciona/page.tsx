"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function ComoFuncionaPage() {
  const { theme } = useTheme();

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Como Funciona</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Aprenda a usar o sistema de registro de entradas
        </p>
      </div>

      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Instruções
        </h2>
        <div className={`space-y-3 text-sm ${textSecondary}`}>
          <p>
            1. <strong>Defina sua Banca:</strong> Acesse a página &quot;Banca&quot; e
            informe o valor inicial da sua banca.
          </p>
          <p>
            2. <strong>Registre Entradas:</strong> Vá em &quot;Registrar Entradas&quot;
            e preencha unidades, odd, mercado e resultado de cada aposta.
          </p>
          <p>
            3. <strong>Acompanhe Resultados:</strong> Veja todas suas entradas
            em &quot;Minhas Entradas&quot; e acompanhe métricas em &quot;Relatórios&quot;.
          </p>
          <p>
            4. <strong>Analise Performance:</strong> Use os gráficos e
            projeções para melhorar sua estratégia.
          </p>
        </div>
      </div>
    </div>
  );
}
