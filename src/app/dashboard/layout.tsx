"use client";

import { usePathname, useRouter } from "next/navigation";
import Header from "@/components/Header";
import DashboardNavCards from "@/components/DashboardNavCards";
import FeedbackWidget from "@/components/FeedbackWidget";
import { useTheme } from "@/contexts/ThemeContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const isSubPage = pathname !== "/dashboard";

  return (
    <AnalyticsProvider>
      <div
        className={`min-h-screen ${
          theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
        }`}
      >
        <FeedbackWidget />
        <Header />

        {/* Content - pt-14 = 56px (altura do header) */}
        <main
          className={`pt-14 ${
            theme === "dark" ? "bg-zinc-950" : "bg-zinc-50"
          }`}
        >
          <div className="p-4 md:p-8">
            <div className="mx-auto w-full max-w-6xl space-y-6">
              {/* Botão Voltar - só aparece em sub-páginas */}
              {isSubPage && (
                <button
                  onClick={() => router.back()}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    theme === "dark"
                      ? "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Voltar
                </button>
              )}

              {/* Navigation Cards - sempre visível em todas as páginas */}
              <DashboardNavCards />

              {/* Conteúdo da página */}
              {children}
            </div>
          </div>
        </main>
      </div>
    </AnalyticsProvider>
  );
}
