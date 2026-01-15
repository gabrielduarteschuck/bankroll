"use client";

import { useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ComoFuncionaPage() {
  const { theme } = useTheme();
  const [videoUrl, setVideoUrl] = useState("");

  // Classes de tema
  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-800" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  // Extrai o ID do vídeo do YouTube
  function extractVideoId(url: string): string | null {
    if (!url) return null;
    const regExp =
      /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[7].length === 11 ? match[7] : null;
  }

  const videoId = extractVideoId(videoUrl);

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
          Vídeo Tutorial
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="video-url"
              className={`block text-sm font-medium ${textSecondary} mb-2`}
            >
              URL do Vídeo do YouTube
            </label>
            <input
              type="text"
              id="video-url"
              placeholder="Cole aqui a URL do vídeo do YouTube (ex: https://www.youtube.com/watch?v=...)"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={`w-full p-3 rounded-lg border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent`}
            />
            <p className={`text-xs ${textTertiary} mt-1`}>
              Cole a URL completa do vídeo do YouTube
            </p>
          </div>

          {videoId && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {videoUrl && !videoId && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              URL inválida. Por favor, cole uma URL válida do YouTube.
            </div>
          )}

          {!videoUrl && (
            <div className={`p-8 rounded-lg border-2 border-dashed ${cardBorder} ${
              theme === "dark" ? "bg-zinc-800" : "bg-zinc-50"
            } text-center`}>
              <div className={`${textTertiary} mb-2`}>
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className={`${textTertiary} text-sm`}>
                Cole a URL do vídeo do YouTube acima
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
        <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>
          Instruções
        </h2>
        <div className={`space-y-3 text-sm ${textSecondary}`}>
          <p>
            1. <strong>Defina sua Banca:</strong> Acesse a página "Banca" e
            informe o valor inicial da sua banca.
          </p>
          <p>
            2. <strong>Registre Entradas:</strong> Vá em "Registrar Entradas"
            e preencha stake, odd, mercado e resultado de cada aposta.
          </p>
          <p>
            3. <strong>Acompanhe Resultados:</strong> Veja todas suas entradas
            em "Minhas Entradas" e acompanhe métricas em "Relatórios".
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
