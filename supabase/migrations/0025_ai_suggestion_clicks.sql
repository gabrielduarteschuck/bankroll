-- Migration: tracking de cliques no CTA de ai_suggestions + relatório admin
-- Data: 2026-01-21
-- Objetivo:
-- - registrar cliques no botão CTA das sugestões editoriais
-- - permitir INSERT por usuários autenticados
-- - permitir SELECT apenas para admin (public.is_admin)
-- - fornecer RPCs simples para relatório (admin-only)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_suggestion_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suggestion_id UUID NOT NULL REFERENCES public.ai_suggestions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_clicks_suggestion_id
  ON public.ai_suggestion_clicks (suggestion_id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_clicks_created_at_desc
  ON public.ai_suggestion_clicks (created_at DESC);

ALTER TABLE public.ai_suggestion_clicks ENABLE ROW LEVEL SECURITY;

-- Grants básicos (RLS controla o acesso)
GRANT INSERT, SELECT ON public.ai_suggestion_clicks TO authenticated;

-- Policies (idempotente)
DROP POLICY IF EXISTS "ai_suggestion_clicks_insert_auth" ON public.ai_suggestion_clicks;
DROP POLICY IF EXISTS "ai_suggestion_clicks_select_admin" ON public.ai_suggestion_clicks;

-- Usuário autenticado: pode apenas inserir (user_id pode ser NULL ou auth.uid())
CREATE POLICY "ai_suggestion_clicks_insert_auth"
ON public.ai_suggestion_clicks
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Admin: pode ler todos os cliques
CREATE POLICY "ai_suggestion_clicks_select_admin"
ON public.ai_suggestion_clicks
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- RPC: total de cliques (admin-only)
CREATE OR REPLACE FUNCTION public.ai_suggestion_clicks_total()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN (SELECT COUNT(*)::INT FROM public.ai_suggestion_clicks);
END;
$$;

-- RPC: cliques por sugestão (admin-only)
CREATE OR REPLACE FUNCTION public.ai_suggestion_clicks_report()
RETURNS TABLE (
  suggestion_id UUID,
  clicks INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
    SELECT c.suggestion_id, COUNT(*)::INT AS clicks
    FROM public.ai_suggestion_clicks c
    GROUP BY c.suggestion_id
    ORDER BY COUNT(*) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_suggestion_clicks_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_suggestion_clicks_report() TO authenticated;

