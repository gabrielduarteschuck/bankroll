-- Migration: feedbacks do usuário (widget flutuante)
-- Objetivo:
-- - salvar feedbacks (até 250 caracteres) por usuário autenticado
-- - admins visualizam todos via painel /admin

-- Extensão para UUIDs (Supabase geralmente já possui, mas garantimos)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feedbacks_message_len CHECK (char_length(message) <= 250)
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON public.feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON public.feedbacks(created_at DESC);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Limpa policies antigas (idempotência)
DROP POLICY IF EXISTS "feedbacks_insert_own" ON public.feedbacks;
DROP POLICY IF EXISTS "feedbacks_select_own" ON public.feedbacks;
DROP POLICY IF EXISTS "feedbacks_admin_select" ON public.feedbacks;
DROP POLICY IF EXISTS "feedbacks_admin_delete" ON public.feedbacks;

-- Usuário autenticado pode inserir apenas o próprio feedback
CREATE POLICY "feedbacks_insert_own" ON public.feedbacks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- (Opcional) Usuário autenticado pode ver apenas os próprios feedbacks
CREATE POLICY "feedbacks_select_own" ON public.feedbacks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin pode ver todos
CREATE POLICY "feedbacks_admin_select" ON public.feedbacks
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admin pode deletar (opcional)
CREATE POLICY "feedbacks_admin_delete" ON public.feedbacks
  FOR DELETE
  USING (public.is_admin(auth.uid()));

