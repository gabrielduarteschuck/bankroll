"use client";

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
