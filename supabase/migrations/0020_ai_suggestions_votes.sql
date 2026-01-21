-- Migration: votos em análises editoriais (ai_suggestions_votes) + agregação
-- Data: 2026-01-20
-- Objetivo:
-- - permitir like/dislike em ai_suggestions
-- - 1 voto por usuário por análise (unique)
-- - contadores públicos sem expor user_id para o client (revoke coluna + RPC)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_suggestions_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suggestion_id UUID NOT NULL REFERENCES public.ai_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL,
  CONSTRAINT ai_suggestions_votes_vote_chk CHECK (vote IN (-1, 1))
);

-- Impede voto duplicado por usuário na mesma sugestão
CREATE UNIQUE INDEX IF NOT EXISTS ai_suggestions_votes_unique_suggestion_user
  ON public.ai_suggestions_votes (suggestion_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_votes_suggestion_id
  ON public.ai_suggestions_votes (suggestion_id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_votes_created_at_desc
  ON public.ai_suggestions_votes (created_at DESC);

ALTER TABLE public.ai_suggestions_votes ENABLE ROW LEVEL SECURITY;

-- Garantir privilégios básicos (RLS ainda controla o acesso)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_suggestions_votes TO authenticated;

-- Não expor user_id para o client (UI não precisa disso)
REVOKE SELECT (user_id) ON public.ai_suggestions_votes FROM authenticated;
GRANT SELECT (id, created_at, suggestion_id, vote) ON public.ai_suggestions_votes TO authenticated;

-- Policies (idempotente)
DROP POLICY IF EXISTS "ai_suggestions_votes_select_auth" ON public.ai_suggestions_votes;
DROP POLICY IF EXISTS "ai_suggestions_votes_insert_own" ON public.ai_suggestions_votes;
DROP POLICY IF EXISTS "ai_suggestions_votes_update_own" ON public.ai_suggestions_votes;
DROP POLICY IF EXISTS "ai_suggestions_votes_delete_own" ON public.ai_suggestions_votes;
DROP POLICY IF EXISTS "ai_suggestions_votes_admin_all" ON public.ai_suggestions_votes;

-- SELECT: usuários autenticados podem ver votos (sem user_id)
CREATE POLICY "ai_suggestions_votes_select_auth"
ON public.ai_suggestions_votes
FOR SELECT
TO authenticated
USING (TRUE);

-- INSERT: usuário só vota por si
CREATE POLICY "ai_suggestions_votes_insert_own"
ON public.ai_suggestions_votes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND vote IN (-1, 1));

-- UPDATE: usuário só altera o próprio voto (like <-> dislike)
CREATE POLICY "ai_suggestions_votes_update_own"
ON public.ai_suggestions_votes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND vote IN (-1, 1));

-- DELETE: usuário só remove o próprio voto
CREATE POLICY "ai_suggestions_votes_delete_own"
ON public.ai_suggestions_votes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admin: acesso total (útil para moderação/debug)
CREATE POLICY "ai_suggestions_votes_admin_all"
ON public.ai_suggestions_votes
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- RPC: retorna agregados + voto do usuário atual (sem expor user_id)
CREATE OR REPLACE FUNCTION public.ai_suggestions_votes_aggregate(suggestion_ids UUID[])
RETURNS TABLE (
  suggestion_id UUID,
  likes INTEGER,
  dislikes INTEGER,
  my_vote SMALLINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT unnest(suggestion_ids) AS suggestion_id
  ),
  agg AS (
    SELECT
      v.suggestion_id,
      COUNT(*) FILTER (WHERE v.vote = 1)::INT AS likes,
      COUNT(*) FILTER (WHERE v.vote = -1)::INT AS dislikes
    FROM public.ai_suggestions_votes v
    WHERE v.suggestion_id = ANY (suggestion_ids)
    GROUP BY v.suggestion_id
  ),
  mine AS (
    SELECT v.suggestion_id, v.vote AS my_vote
    FROM public.ai_suggestions_votes v
    WHERE v.user_id = auth.uid()
      AND v.suggestion_id = ANY (suggestion_ids)
  )
  SELECT
    b.suggestion_id,
    COALESCE(a.likes, 0) AS likes,
    COALESCE(a.dislikes, 0) AS dislikes,
    m.my_vote
  FROM base b
  LEFT JOIN agg a USING (suggestion_id)
  LEFT JOIN mine m USING (suggestion_id);
$$;

GRANT EXECUTE ON FUNCTION public.ai_suggestions_votes_aggregate(UUID[]) TO authenticated;

