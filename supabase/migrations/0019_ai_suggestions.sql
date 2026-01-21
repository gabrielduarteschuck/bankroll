-- Migration: conteúdo editorial - análises da IA (ai_suggestions) com RLS
-- Data: 2026-01-20
-- Objetivo:
-- - permitir que admins publiquem análises/sugestões editoriais
-- - usuários autenticados podem ler (para consumo no app)
-- - apenas admin pode inserir/atualizar/deletar

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  esporte TEXT NOT NULL,
  mercado TEXT NOT NULL,
  descricao TEXT NOT NULL,
  odd NUMERIC NOT NULL,
  confianca_percent INT NOT NULL,
  link_bilhete_final TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ai_suggestions_confianca_chk CHECK (confianca_percent >= 0 AND confianca_percent <= 100),
  CONSTRAINT ai_suggestions_odd_chk CHECK (odd > 1)
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_created_at_desc
  ON public.ai_suggestions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_esporte
  ON public.ai_suggestions (esporte);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Policies (idempotente)
DROP POLICY IF EXISTS "ai_suggestions_select_auth" ON public.ai_suggestions;
DROP POLICY IF EXISTS "ai_suggestions_admin_all" ON public.ai_suggestions;

-- Usuário autenticado: pode ler (conteúdo editorial)
CREATE POLICY "ai_suggestions_select_auth"
ON public.ai_suggestions
FOR SELECT
TO authenticated
USING (TRUE);

-- Admin: CRUD completo
CREATE POLICY "ai_suggestions_admin_all"
ON public.ai_suggestions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

