"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabaseClient";
import { NBA_LOGOS } from "@/components/nba-logos";
import PremiumPaywall from "@/components/PremiumPaywall";

type AiSuggestion = {
  id: string;
  league: string;
  game_id: string | null;
  home_team: string | null;
  away_team: string | null;
  esporte: string;
  mercado: string;
  descricao: string;
  odd: number;
  confianca_percent: number;
  link_bilhete_final: string | null;
  created_at: string;
};

type VoteAggRow = {
  suggestion_id: string;
  likes: number;
  dislikes: number;
  my_vote: 1 | -1 | null;
};

export default function SugestoesIAPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBg = theme === "dark" ? "bg-zinc-900" : "bg-white";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  const [loading, setLoading] = useState(true);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AiSuggestion[]>([]);
  const [voteAgg, setVoteAgg] = useState<Record<string, VoteAggRow>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votesUnavailable, setVotesUnavailable] = useState(false);

  const ids = useMemo(() => items.map((x) => x.id), [items]);

  // Verificar se usuário é premium
  useEffect(() => {
    async function checkPremium() {
      try {
        const { data: paid } = await supabase.rpc("has_paid_access");
        setIsPremium(paid === true);
      } catch {
        setIsPremium(false);
      } finally {
        setCheckingPremium(false);
      }
    }
    checkPremium();
  }, []);

  useEffect(() => {
    if (!checkingPremium && isPremium) {
      void load();
    } else if (!checkingPremium && !isPremium) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingPremium, isPremium]);

  async function load() {
    setLoading(true);
    setError(null);
    setVotesUnavailable(false);
    try {
      const { data, error: listErr } = await supabase
        .from("ai_suggestions")
        .select(
          "id, league, game_id, home_team, away_team, esporte, mercado, descricao, odd, confianca_percent, link_bilhete_final, created_at"
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (listErr) {
        const msg = String(listErr.message || "").toLowerCase();
        if (msg.includes("ai_suggestions")) {
          setError("Conteúdo ainda não disponível. Aplique a migration da tabela ai_suggestions no Supabase.");
        } else {
          setError("Erro ao carregar sugestões.");
        }
        setItems([]);
        return;
      }

      setItems((data || []) as AiSuggestion[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ids.length === 0) {
      setVoteAgg({});
      return;
    }
    void loadVotes(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")]);

  async function loadVotes(suggestionIds: string[]) {
    try {
      const { data, error: aggErr } = await supabase.rpc("ai_suggestions_votes_aggregate", {
        suggestion_ids: suggestionIds,
      });

      if (aggErr) {
        setVotesUnavailable(true);
        setVoteAgg({});
        return;
      }

      const rows = (data || []) as VoteAggRow[];
      const map: Record<string, VoteAggRow> = {};
      for (const r of rows) map[String(r.suggestion_id)] = r;
      setVoteAgg(map);
    } catch {
      setVotesUnavailable(true);
      setVoteAgg({});
    }
  }

  function normalizeTeamKey(v: unknown): string {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }

  function TeamLogo({ code }: { code: string }) {
    const key = String(code || "").trim().toLowerCase();
    const Logo = key ? NBA_LOGOS[key] : undefined;
    if (!Logo) {
      return <img src="/team-placeholder.svg" alt={code} className="h-8 w-8" />;
    }
    return <Logo size={32} />;
  }

  function getAgg(id: string): VoteAggRow {
    return (
      voteAgg[id] || {
        suggestion_id: id,
        likes: 0,
        dislikes: 0,
        my_vote: null,
      }
    );
  }

  async function vote(suggestionId: string, v: 1 | -1) {
    if (votingId) return;
    setVotingId(suggestionId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const current = getAgg(suggestionId).my_vote;
      if (current === v) {
        // toggle off -> remove voto
        await supabase
          .from("ai_suggestions_votes")
          .delete()
          .eq("suggestion_id", suggestionId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("ai_suggestions_votes")
          .upsert(
            { suggestion_id: suggestionId, user_id: user.id, vote: v },
            { onConflict: "suggestion_id,user_id" }
          );
      }

      await loadVotes(ids);
    } finally {
      setVotingId(null);
    }
  }

  // Loading premium check
  if (checkingPremium) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className={`w-8 h-8 border-2 rounded-full animate-spin ${
          theme === "dark" ? "border-zinc-700 border-t-white" : "border-zinc-200 border-t-zinc-900"
        }`} />
      </div>
    );
  }

  // Paywall para não-premium
  if (!isPremium) {
    return <PremiumPaywall feature="sugestoes" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Sugestões da IA</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Sugestoes analisadas pela IA com base nas estatísticas e cotações publicadas nas casas de apostas
        </p>
      </div>

      {error ? (
        <div
          className={`rounded-2xl border p-6 shadow-sm ${
            theme === "dark"
              ? "border-red-800 bg-red-900/20 text-red-200"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-44 rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm`}>
          <div className={`text-sm ${textSecondary}`}>Sem sugestões ainda</div>
          <div className={`mt-1 text-xs ${textTertiary}`}>
            Quando houver publicações, elas aparecerão aqui.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((s) => {
            const agg = getAgg(s.id);
            const hasLink = !!(s.link_bilhete_final && String(s.link_bilhete_final).trim());
            const isLike = agg.my_vote === 1;
            const isDislike = agg.my_vote === -1;
            const homeTeamKey = normalizeTeamKey(s.home_team);
            const awayTeamKey = normalizeTeamKey(s.away_team);
            const hasMatchup = !!(homeTeamKey || awayTeamKey);

            return (
              <div
                key={s.id}
                className={`group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition-all ${
                  theme === "dark"
                    ? "border-emerald-500/20 bg-zinc-950 hover:border-emerald-500/35 hover:shadow-lg hover:shadow-emerald-500/10"
                    : "border-emerald-200 bg-white hover:border-emerald-300 hover:shadow-md"
                }`}
              >
                <div
                  className={`pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl ${
                    theme === "dark" ? "bg-emerald-500/10" : "bg-emerald-500/15"
                  }`}
                />

                <div className="relative space-y-4">
                  {/* Confronto (logos locais via NBA_LOGOS) */}
                  {hasMatchup ? (
                    <div
                      className={`rounded-2xl border px-4 py-3 ${
                        theme === "dark"
                          ? "border-zinc-800 bg-zinc-900/60"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <TeamLogo code={homeTeamKey} />
                          <div className={`text-sm font-semibold ${textPrimary}`}>
                            {(homeTeamKey || "—").toUpperCase()}
                          </div>
                        </div>

                        <div className={`text-xs font-bold ${textTertiary}`}>VS</div>

                        <div className="flex items-center gap-2 min-w-0 justify-end">
                          <div className={`text-sm font-semibold ${textPrimary}`}>
                            {(awayTeamKey || "—").toUpperCase()}
                          </div>
                          <TeamLogo code={awayTeamKey} />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold uppercase tracking-wider ${
                        theme === "dark" ? "text-emerald-200/90" : "text-emerald-800"
                      }`}>
                        Editorial • IA
                      </div>
                      <div className={`mt-2 text-sm font-semibold ${textPrimary}`}>
                        {s.esporte}
                      </div>
                      <div className={`mt-1 text-sm ${textSecondary}`}>
                        <span className="font-semibold">Mercado:</span> {s.mercado}
                      </div>
                    </div>

                    <div
                      className={`shrink-0 rounded-2xl border px-4 py-3 text-center ${
                        theme === "dark"
                          ? "border-zinc-800 bg-zinc-900/60"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className={`text-xs ${textTertiary}`}>Odd</div>
                      <div className={`text-lg font-bold ${textPrimary}`}>
                        {Number(s.odd).toFixed(2)}
                      </div>
                      <div className={`mt-1 text-xs ${textTertiary}`}>Confiança</div>
                      <div className={`text-sm font-semibold ${
                        theme === "dark" ? "text-emerald-200" : "text-emerald-700"
                      }`}>
                        {s.confianca_percent}%
                      </div>
                    </div>
                  </div>

                  <div className={`text-sm ${textSecondary}`}>
                    {s.descricao}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={!hasLink}
                      onClick={async () => {
                        if (!hasLink) return;
                        const url = String(s.link_bilhete_final);
                        try {
                          const {
                            data: { user },
                          } = await supabase.auth.getUser();
                          await supabase.from("ai_suggestion_clicks").insert({
                            suggestion_id: s.id,
                            user_id: user?.id ?? null,
                          });
                        } catch {
                          // tracking best-effort (não bloquear CTA)
                        } finally {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className={`h-11 px-4 rounded-xl font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        theme === "dark"
                          ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                          : "bg-zinc-900 text-white hover:bg-zinc-800"
                      }`}
                    >
                      Abrir na casa de apostas
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === s.id}
                        onClick={() => vote(s.id, 1)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          isLike
                            ? theme === "dark"
                              ? "border-emerald-500/40 bg-emerald-900/20 text-emerald-200"
                              : "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : theme === "dark"
                              ? "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                              : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                        }`}
                        aria-label="Like"
                      >
                        <span>👍</span>
                        <span className="tabular-nums">{agg.likes}</span>
                      </button>

                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === s.id}
                        onClick={() => vote(s.id, -1)}
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          isDislike
                            ? theme === "dark"
                              ? "border-red-500/40 bg-red-900/20 text-red-200"
                              : "border-red-300 bg-red-50 text-red-800"
                            : theme === "dark"
                              ? "border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                              : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                        }`}
                        aria-label="Dislike"
                      >
                        <span>👎</span>
                        <span className="tabular-nums">{agg.dislikes}</span>
                      </button>
                    </div>
                  </div>

                  {votesUnavailable && (
                    <div className={`text-xs ${textTertiary}`}>
                      Votação indisponível (aplique a migration de votos).
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

