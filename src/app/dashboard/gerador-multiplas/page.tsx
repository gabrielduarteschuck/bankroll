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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className={`group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition-all ${
                  theme === "dark"
                    ? "border-amber-500/20 bg-zinc-950 hover:border-amber-500/35 hover:shadow-lg hover:shadow-amber-500/10"
                    : "border-amber-200 bg-white hover:border-amber-300 hover:shadow-md"
                }`}
              >
                <div
                  className={`pointer-events-none absolute -top-24 right-0 h-56 w-56 rounded-full blur-3xl ${
                    theme === "dark" ? "bg-amber-500/10" : "bg-amber-500/15"
                  }`}
                />

                <div className="relative space-y-4">
                  {/* Header: Entrada XX, Tipo, Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        theme === "dark" ? "text-amber-200/90" : "text-amber-800"
                      }`}>
                        Entrada {entradaNum}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        theme === "dark" ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-800"
                      }`}>
                        Multipla
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      isAberto
                        ? theme === "dark"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-emerald-100 text-emerald-700"
                        : theme === "dark"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-red-100 text-red-700"
                    }`}>
                      {isAberto ? 'ABERTO' : 'FECHADO'}
                    </span>
                  </div>

                  {/* Imagem do bilhete (se houver) */}
                  {m.image_url && (
                    <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
                      <img
                        src={m.image_url}
                        alt={m.titulo}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  )}

                  {/* Bloco de destaque: Odd Total, Qtd Jogos, % Chance de Green */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-lg font-bold ${textPrimary}`}>{m.titulo}</h3>
                    </div>

                    <div
                      className={`shrink-0 rounded-2xl border px-4 py-3 text-center min-w-[100px] ${
                        theme === "dark"
                          ? "border-zinc-800 bg-zinc-900/60"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className={`text-xs ${textTertiary}`}>Odd Total</div>
                      <div className={`text-xl font-bold ${textPrimary}`}>
                        {Number(m.odd_total).toFixed(2)}
                      </div>
                      <div className={`mt-1 text-xs ${textTertiary}`}>Chance Green</div>
                      <div className={`text-sm font-semibold ${
                        confianca >= 70
                          ? theme === "dark" ? "text-emerald-300" : "text-emerald-600"
                          : confianca >= 50
                            ? theme === "dark" ? "text-amber-300" : "text-amber-600"
                            : theme === "dark" ? "text-red-300" : "text-red-600"
                      }`}>
                        {confianca}%
                      </div>
                    </div>
                  </div>

                  {/* Info adicional */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      theme === "dark" ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-700"
                    }`}>
                      {m.quantidade_jogos} {m.quantidade_jogos === 1 ? 'jogo' : 'jogos'}
                    </span>
                    <span className={`text-xs ${textTertiary}`}>
                      Publicado em {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>

                  {/* Descricao completa */}
                  <div className={`text-sm ${textSecondary} whitespace-pre-wrap`}>
                    {m.descricao}
                  </div>

                  {/* Botoes: CTA e Votos */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={!hasLink}
                      onClick={() => {
                        if (!hasLink) return;
                        const url = String(m.link_bilhete);
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className={`h-11 px-5 rounded-xl font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                        theme === "dark"
                          ? "bg-amber-500 text-white hover:bg-amber-400"
                          : "bg-amber-500 text-white hover:bg-amber-600"
                      }`}
                    >
                      Abrir Bilhete
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === m.id}
                        onClick={() => vote(m.id, 1)}
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
                        <span>GREEN</span>
                        <span className="tabular-nums">{agg.likes}</span>
                      </button>

                      <button
                        type="button"
                        disabled={votesUnavailable || votingId === m.id}
                        onClick={() => vote(m.id, -1)}
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
                        <span>RED</span>
                        <span className="tabular-nums">{agg.dislikes}</span>
                      </button>
                    </div>
                  </div>

                  {votesUnavailable && (
                    <div className={`text-xs ${textTertiary}`}>
                      Votacao indisponivel (aplique a migration de votos).
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
