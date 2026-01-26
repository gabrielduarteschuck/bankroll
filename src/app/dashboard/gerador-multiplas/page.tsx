"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabaseClient";
import PremiumPaywall from "@/components/PremiumPaywall";

type Multipla = {
  id: string;
  titulo: string;
  descricao: string;
  odd_total: number;
  quantidade_jogos: number;
  confianca_percent: number;
  status: 'ABERTO' | 'FECHADO';
  image_url: string | null;
  link_bilhete: string | null;
  created_at: string;
};

type VoteAggRow = {
  multipla_id: string;
  likes: number;
  dislikes: number;
  my_vote: 1 | -1 | null;
};

export default function GeradorMultiplasPage() {
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";

  const [loading, setLoading] = useState(true);
  const [checkingPremium, setCheckingPremium] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [items, setItems] = useState<Multipla[]>([]);
  const [voteAgg, setVoteAgg] = useState<Record<string, VoteAggRow>>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [votesUnavailable, setVotesUnavailable] = useState(false);

  const ids = useMemo(() => items.map((x) => x.id), [items]);

  // Verificar se usuario e premium
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
      void loadMultiplas();
    } else if (!checkingPremium && !isPremium) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingPremium, isPremium]);

  async function loadMultiplas() {
    setLoading(true);
    setVotesUnavailable(false);
    try {
      const { data } = await supabase
        .from("multiplas")
        .select("*")
        .eq("is_published", true)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      setItems((data || []) as Multipla[]);
    } catch {
      setItems([]);
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

  async function loadVotes(multiplaIds: string[]) {
    try {
      const { data, error: aggErr } = await supabase.rpc("multiplas_votes_aggregate", {
        multipla_ids: multiplaIds,
      });

      if (aggErr) {
        setVotesUnavailable(true);
        setVoteAgg({});
        return;
      }

      const rows = (data || []) as VoteAggRow[];
      const map: Record<string, VoteAggRow> = {};
      for (const r of rows) map[String(r.multipla_id)] = r;
      setVoteAgg(map);
    } catch {
      setVotesUnavailable(true);
      setVoteAgg({});
    }
  }

  function getAgg(id: string): VoteAggRow {
    return (
      voteAgg[id] || {
        multipla_id: id,
        likes: 0,
        dislikes: 0,
        my_vote: null,
      }
    );
  }

  async function vote(multiplaId: string, v: 1 | -1) {
    if (votingId) return;
    setVotingId(multiplaId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const current = getAgg(multiplaId).my_vote;
      if (current === v) {
        // toggle off -> remove voto
        await supabase
          .from("multiplas_votes")
          .delete()
          .eq("multipla_id", multiplaId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("multiplas_votes")
          .upsert(
            { multipla_id: multiplaId, user_id: user.id, vote: v },
            { onConflict: "multipla_id,user_id" }
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

  // Paywall para nao-premium
  if (!isPremium) {
    return <PremiumPaywall feature="multiplas" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Gerador de Multiplas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Multiplas exclusivas selecionadas por especialistas para potencializar seus ganhos
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-64 rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`rounded-2xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900" : "bg-white"} p-8 text-center`}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className={`text-lg font-semibold ${textPrimary}`}>Nenhuma multipla disponivel</h3>
          <p className={`mt-2 text-sm ${textSecondary}`}>
            Novas multiplas serao publicadas em breve. Volte mais tarde!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {items.map((m, index) => {
            const agg = getAgg(m.id);
            const hasLink = !!(m.link_bilhete && String(m.link_bilhete).trim());
            const isLike = agg.my_vote === 1;
            const isDislike = agg.my_vote === -1;
            const entradaNum = String(index + 1).padStart(2, '0');
            const confianca = m.confianca_percent || 50;
            const isAberto = m.status !== 'FECHADO';

            return (
              <div
                key={m.id}
                className={`group relative rounded-2xl border shadow-sm transition-all ${
                  theme === "dark"
                    ? "border-amber-500/20 bg-zinc-900 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5"
                    : "border-amber-200 bg-white hover:border-amber-300 hover:shadow-md"
                }`}
              >
                {/* Glow decorativo */}
                <div
                  className={`pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl ${
                    theme === "dark" ? "bg-amber-500/5" : "bg-amber-500/10"
                  }`}
                />

                {/* Container principal com padding consistente */}
                <div className="relative p-5 sm:p-6 flex flex-col gap-5">

                  {/* HEADER: Entrada + Tipo + Status */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        theme === "dark" ? "text-amber-300" : "text-amber-700"
                      }`}>
                        Entrada {entradaNum}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        theme === "dark" ? "bg-amber-500/20 text-amber-200" : "bg-amber-100 text-amber-700"
                      }`}>
                        Multipla
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${
                      isAberto
                        ? theme === "dark"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : theme === "dark"
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-red-50 text-red-600 border border-red-200"
                    }`}>
                      {isAberto ? 'ABERTO' : 'FECHADO'}
                    </span>
                  </div>

                  {/* BLOCO DE RESUMO: Card visual independente */}
                  <div className={`rounded-xl p-4 ${
                    theme === "dark"
                      ? "bg-zinc-800/50 border border-zinc-700/50"
                      : "bg-zinc-50 border border-zinc-200"
                  }`}>
                    <div className="flex items-center justify-between gap-4">
                      {/* Odd Total - destaque principal */}
                      <div className="text-center flex-1">
                        <div className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${textTertiary}`}>
                          Odd Total
                        </div>
                        <div className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>
                          {Number(m.odd_total).toFixed(2)}
                        </div>
                      </div>

                      {/* Divisor vertical */}
                      <div className={`w-px h-12 ${
                        theme === "dark" ? "bg-zinc-700" : "bg-zinc-300"
                      }`} />

                      {/* Quantidade de jogos */}
                      <div className="text-center flex-1">
                        <div className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${textTertiary}`}>
                          Jogos
                        </div>
                        <div className={`text-2xl sm:text-3xl font-bold ${textPrimary}`}>
                          {m.quantidade_jogos}
                        </div>
                      </div>

                      {/* Divisor vertical */}
                      <div className={`w-px h-12 ${
                        theme === "dark" ? "bg-zinc-700" : "bg-zinc-300"
                      }`} />

                      {/* Chance de Green */}
                      <div className="text-center flex-1">
                        <div className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${textTertiary}`}>
                          Chance Green
                        </div>
                        <div className={`text-2xl sm:text-3xl font-bold ${
                          confianca >= 70
                            ? theme === "dark" ? "text-emerald-400" : "text-emerald-600"
                            : confianca >= 50
                              ? theme === "dark" ? "text-amber-400" : "text-amber-600"
                              : theme === "dark" ? "text-red-400" : "text-red-600"
                        }`}>
                          {confianca}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TITULO */}
                  <div>
                    <h3 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
                      {m.titulo}
                    </h3>
                    <p className={`text-xs mt-1 ${textTertiary}`}>
                      Publicado em {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  {/* IMAGEM DO BILHETE (se houver) - Card independente */}
                  {m.image_url && (
                    <div className={`rounded-xl overflow-hidden border ${
                      theme === "dark" ? "border-zinc-700/50" : "border-zinc-200"
                    }`}>
                      <img
                        src={m.image_url}
                        alt={m.titulo}
                        className="w-full h-auto max-h-[300px] object-contain bg-black/5"
                      />
                    </div>
                  )}

                  {/* DESCRICAO - Card independente com respiro */}
                  {m.descricao && (
                    <div className={`rounded-xl p-4 ${
                      theme === "dark"
                        ? "bg-zinc-800/30 border border-zinc-700/30"
                        : "bg-zinc-50/50 border border-zinc-200/50"
                    }`}>
                      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${textSecondary}`}>
                        {m.descricao}
                      </div>
                    </div>
                  )}

                  {/* ACOES: Botao + Votos */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <button
                      type="button"
                      disabled={!hasLink}
                      onClick={() => {
                        if (!hasLink) return;
                        const url = String(m.link_bilhete);
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className={`h-11 px-6 rounded-xl font-semibold text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        theme === "dark"
                          ? "bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20"
                          : "bg-amber-500 text-white hover:bg-amber-600 shadow-md"
                      }`}
                    >
                      Abrir Bilhete
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === m.id}
                        onClick={() => vote(m.id, 1)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isLike
                            ? theme === "dark"
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                              : "border-emerald-400 bg-emerald-50 text-emerald-700"
                            : theme === "dark"
                              ? "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                        aria-label="Green"
                      >
                        <span className="text-emerald-500">●</span>
                        <span>GREEN</span>
                        <span className="tabular-nums opacity-70">{agg.likes}</span>
                      </button>

                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === m.id}
                        onClick={() => vote(m.id, -1)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isDislike
                            ? theme === "dark"
                              ? "border-red-500/50 bg-red-500/15 text-red-300"
                              : "border-red-400 bg-red-50 text-red-700"
                            : theme === "dark"
                              ? "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/50"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                        aria-label="Red"
                      >
                        <span className="text-red-500">●</span>
                        <span>RED</span>
                        <span className="tabular-nums opacity-70">{agg.dislikes}</span>
                      </button>
                    </div>
                  </div>

                  {votesUnavailable && (
                    <p className={`text-xs ${textTertiary}`}>
                      Votacao indisponivel (aplique a migration de votos).
                    </p>
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
