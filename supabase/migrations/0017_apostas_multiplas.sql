-- Migration: apostas múltiplas (pai + itens) com RLS
-- Data: 2026-01-16
-- Objetivo:
-- - salvar apostas combinadas (múltiplas) por usuário
-- - itens/seleções vinculados à múltipla

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Tabela pai: apostas_multiplas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.apostas_multiplas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidades NUMERIC(10, 2) NOT NULL,
  valor_unidade NUMERIC(10, 2) NOT NULL,
  valor_apostado NUMERIC(10, 2) NOT NULL,
  odd_combinada NUMERIC(10, 4) NOT NULL,
  casa TEXT,
  tipster TEXT,
  data_aposta DATE,
  resultado VARCHAR(10) NOT NULL CHECK (resultado IN ('green', 'red', 'pendente')) DEFAULT 'pendente',
  valor_resultado NUMERIC(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apostas_multiplas_user_id
  ON public.apostas_multiplas (user_id);
CREATE INDEX IF NOT EXISTS idx_apostas_multiplas_created_at
  ON public.apostas_multiplas (created_at DESC);

ALTER TABLE public.apostas_multiplas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apostas_multiplas_select_own" ON public.apostas_multiplas;
DROP POLICY IF EXISTS "apostas_multiplas_insert_own" ON public.apostas_multiplas;
DROP POLICY IF EXISTS "apostas_multiplas_update_own" ON public.apostas_multiplas;
DROP POLICY IF EXISTS "apostas_multiplas_delete_own" ON public.apostas_multiplas;
DROP POLICY IF EXISTS "apostas_multiplas_admin_all" ON public.apostas_multiplas;

CREATE POLICY "apostas_multiplas_select_own"
ON public.apostas_multiplas
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_insert_own"
ON public.apostas_multiplas
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_update_own"
ON public.apostas_multiplas
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_delete_own"
ON public.apostas_multiplas
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_admin_all"
ON public.apostas_multiplas
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- Itens: apostas_multiplas_itens
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.apostas_multiplas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  multipla_id UUID NOT NULL REFERENCES public.apostas_multiplas(id) ON DELETE CASCADE,
  esporte TEXT NOT NULL,
  evento TEXT NOT NULL,
  mercado TEXT,
  odd NUMERIC(10, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apostas_multiplas_itens_user_id
  ON public.apostas_multiplas_itens (user_id);
CREATE INDEX IF NOT EXISTS idx_apostas_multiplas_itens_multipla_id
  ON public.apostas_multiplas_itens (multipla_id);

ALTER TABLE public.apostas_multiplas_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apostas_multiplas_itens_select_own" ON public.apostas_multiplas_itens;
DROP POLICY IF EXISTS "apostas_multiplas_itens_insert_own" ON public.apostas_multiplas_itens;
DROP POLICY IF EXISTS "apostas_multiplas_itens_update_own" ON public.apostas_multiplas_itens;
DROP POLICY IF EXISTS "apostas_multiplas_itens_delete_own" ON public.apostas_multiplas_itens;
DROP POLICY IF EXISTS "apostas_multiplas_itens_admin_all" ON public.apostas_multiplas_itens;

CREATE POLICY "apostas_multiplas_itens_select_own"
ON public.apostas_multiplas_itens
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_itens_insert_own"
ON public.apostas_multiplas_itens
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_itens_update_own"
ON public.apostas_multiplas_itens
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_itens_delete_own"
ON public.apostas_multiplas_itens
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "apostas_multiplas_itens_admin_all"
ON public.apostas_multiplas_itens
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

