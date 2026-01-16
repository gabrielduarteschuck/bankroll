"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

export default function FeedbackWidget() {
  const { theme } = useTheme();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const maxLen = 250;
  const remaining = maxLen - text.length;

  const styles = useMemo(() => {
    const panel =
      theme === "dark"
        ? "border-white/10 bg-white/5 text-white"
        : "border-zinc-200 bg-white text-zinc-900";
    const subText = theme === "dark" ? "text-white/60" : "text-zinc-600";
    const input =
      theme === "dark"
        ? "border-white/10 bg-black/30 text-white placeholder-white/30"
        : "border-zinc-200 bg-zinc-50 text-zinc-900 placeholder-zinc-400";
    const btn =
      theme === "dark"
        ? "bg-white/10 hover:bg-white/15 text-white"
        : "bg-zinc-900 hover:bg-zinc-800 text-white";
    const badge =
      theme === "dark"
        ? "border-white/10 bg-white/5 text-white/80"
        : "border-zinc-200 bg-white text-zinc-700";

    return { panel, subText, input, btn, badge };
  }, [theme]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  async function handleSend() {
    const message = text.trim();
    setError(null);
    setSuccess(null);

    if (!message) {
      setError("Digite uma sugestão antes de enviar.");
      return;
    }
    if (message.length > maxLen) {
      setError("Limite excedido. Máximo de 250 caracteres.");
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Você precisa estar logado para enviar feedback.");
        setSending(false);
        return;
      }

      const { error: insertError } = await supabase.from("feedbacks").insert({
        user_id: user.id,
        message,
        page_path: pathname || null,
      });

      if (insertError) {
        setError(insertError.message);
        setSending(false);
        return;
      }

      setSuccess("Obrigado! Feedback enviado.");
      setText("");
      setSending(false);
      setTimeout(() => setOpen(false), 800);
    } catch (err: any) {
      setError(err?.message || "Erro ao enviar feedback.");
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium shadow-lg backdrop-blur-xl cursor-pointer ${styles.panel}`}
          aria-label="Abrir feedback"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
            </svg>
          </span>
          <span>Feedback</span>
          <span className={`ml-1 rounded-md border px-1.5 py-0.5 text-[11px] ${styles.badge}`}>
            F
          </span>
        </button>
      ) : (
        <div className={`w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl backdrop-blur-xl ${styles.panel}`}>
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="text-sm font-semibold">Feedback</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-sm cursor-pointer hover:bg-black/10"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-4 pt-3">
            <div className={`text-xs ${styles.subText} mb-2`}>
              Deixe aqui suas sugestões de melhorias 👍🏻
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, maxLen))}
              maxLength={maxLen}
              rows={5}
              className={`w-full resize-none rounded-xl border px-3 py-3 text-sm outline-none ${styles.input}`}
              placeholder="Escreva aqui..."
            />

            <div className="mt-2 flex items-center justify-between">
              <div className={`text-xs ${styles.subText}`}>
                {remaining} restantes
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${styles.btn}`}
              >
                {sending ? "Enviando..." : "Enviar"}
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                <div className="text-xs text-red-200">{error}</div>
              </div>
            )}
            {success && (
              <div className="mt-3 rounded-xl border border-green-500/25 bg-green-500/10 px-3 py-2">
                <div className="text-xs text-green-100">{success}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

