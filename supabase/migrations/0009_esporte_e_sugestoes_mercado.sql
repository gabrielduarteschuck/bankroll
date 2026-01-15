-- Migration: Esporte em entradas + sugestões de mercado por esporte
-- Data: 2026-01-15
-- Objetivo:
-- 1) Adicionar coluna `esporte` em public.entradas
-- 2) Criar tabela `public.mercados_sugeridos` para salvar mercados sugeridos por esporte (por usuário)
-- 3) Ativar RLS e políticas padrão (usuário só vê/insere seus dados; admin vê tudo)

-- ============================================================================
-- 1) Entradas: adicionar coluna esporte (idempotente)
-- ============================================================================

ALTER TABLE public.entradas
ADD COLUMN IF NOT EXISTS esporte TEXT;

-- Backfill seguro: como antes o app era focado em NBA, preenche registros antigos sem esporte
UPDATE public.entradas
SET esporte = 'Basquete (NBA)'
WHERE esporte IS NULL;

-- ============================================================================
-- 2) Tabela de sugestões: mercados_sugeridos
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mercados_sugeridos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  esporte TEXT NOT NULL,
  mercado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evitar duplicatas por usuário+esporte+mercado
CREATE UNIQUE INDEX IF NOT EXISTS mercados_sugeridos_unique_user_esporte_mercado
  ON public.mercados_sugeridos (user_id, esporte, mercado);

ALTER TABLE public.mercados_sugeridos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3) Policies RLS
-- ============================================================================

-- Remover policies antigas se existirem (idempotente)
DROP POLICY IF EXISTS "mercados_sugeridos_select_own" ON public.mercados_sugeridos;
DROP POLICY IF EXISTS "mercados_sugeridos_insert_own" ON public.mercados_sugeridos;
DROP POLICY IF EXISTS "mercados_sugeridos_delete_own" ON public.mercados_sugeridos;
DROP POLICY IF EXISTS "mercados_sugeridos_admin_all" ON public.mercados_sugeridos;

-- Usuário autenticado: SELECT apenas seus registros
CREATE POLICY "mercados_sugeridos_select_own"
ON public.mercados_sugeridos
FOR SELECT
USING (user_id = auth.uid());

-- Usuário autenticado: INSERT apenas para si mesmo
CREATE POLICY "mercados_sugeridos_insert_own"
ON public.mercados_sugeridos
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Usuário autenticado: DELETE apenas seus registros (se quiser limpar)
CREATE POLICY "mercados_sugeridos_delete_own"
ON public.mercados_sugeridos
FOR DELETE
USING (user_id = auth.uid());

-- Admin: acesso total
CREATE POLICY "mercados_sugeridos_admin_all"
ON public.mercados_sugeridos
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

