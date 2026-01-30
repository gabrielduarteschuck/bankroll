"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import UserMenu from "./UserMenu";
import ThemeToggle from "./ThemeToggle";
import SettingsMenu from "./SettingsMenu";

export default function Header() {
  const { theme } = useTheme();
  const mountCountRef = useRef(0);
  const [instanceId] = useState(() => Math.random().toString(36).substring(7));

  // DEBUG: Log quando o Header monta/remonta
  useEffect(() => {
    mountCountRef.current += 1;
    const msg = `[HEADER DEBUG] MOUNTED - Instance: ${instanceId}, Mount #${mountCountRef.current}, URL: ${window.location.pathname}`;
    console.log(msg);

    return () => {
      console.log(`[HEADER DEBUG] UNMOUNTED - Instance: ${instanceId}, URL: ${window.location.pathname}`);
    };
  }, [instanceId]);

  return (
    <header
      id="app-header"
      data-header-instance={instanceId}
      className={`fixed top-0 left-0 right-0 z-[9999] border-b h-14 ${
        theme === "dark"
          ? "border-zinc-800 bg-zinc-900"
          : "border-zinc-200 bg-white"
      }`}
      style={{
        // Force visibility
        visibility: "visible",
        opacity: 1,
        display: "block"
      }}
    >
      <div className="w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo - Alinhado à esquerda */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div
            aria-label="ProStake"
            className={`h-8 w-8 rounded-lg flex items-center justify-center font-black text-sm border ${
              theme === "dark"
                ? "bg-zinc-800 text-white border-zinc-700"
                : "bg-zinc-900 text-white border-zinc-700/50"
            }`}
          >
            S
          </div>
          <span
            className={`text-base font-semibold ${
              theme === "dark" ? "text-white" : "text-zinc-900"
            }`}
          >
            ProStake
          </span>
        </Link>

        {/* Right side - Controles */}
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <SettingsMenu />
          <div
            className={`w-px h-6 mx-1 sm:mx-2 ${
              theme === "dark" ? "bg-zinc-700" : "bg-zinc-200"
            }`}
          />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
