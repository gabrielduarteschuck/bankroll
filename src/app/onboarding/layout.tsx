"use client";

import { useTheme } from "@/contexts/ThemeContext";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        theme === "dark"
          ? "bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950"
          : "bg-gradient-to-br from-zinc-50 via-white to-zinc-100"
      }`}
    >
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
