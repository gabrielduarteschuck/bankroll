"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function OnboardingPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase.rpc("get_onboarding_status");

      if (data && data.length > 0) {
        const status = data[0];

        if (status.onboarding_completed) {
          router.replace("/dashboard");
          return;
        }

        if (!status.has_banca) {
          router.replace("/onboarding/banca");
          return;
        }

        if (!status.has_entrada) {
          router.replace("/onboarding/entrada");
          return;
        }

        // Tem banca e entrada, vai para final
        router.replace("/onboarding/final");
      } else {
        // Sem dados, começa do início
        router.replace("/onboarding/banca");
      }
    }

    checkStatus();
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center">
        <div
          className={`w-8 h-8 border-2 rounded-full animate-spin ${
            theme === "dark"
              ? "border-zinc-700 border-t-white"
              : "border-zinc-200 border-t-zinc-900"
          }`}
        />
      </div>
    );
  }

  return null;
}
