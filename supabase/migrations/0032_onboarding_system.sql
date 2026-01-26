-- Migration: Sistema de Onboarding
-- Data: 2026-01-25
-- Objetivo: Guiar novos usuários nos primeiros passos

-- ============================================================================
-- 1. ADICIONAR COLUNA DE ONBOARDING EM PROFILES
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- 2. FUNÇÃO PARA VERIFICAR STATUS DO ONBOARDING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS TABLE(
  onboarding_completed BOOLEAN,
  has_banca BOOLEAN,
  has_entrada BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(p.onboarding_completed, FALSE) as onboarding_completed,
    EXISTS(SELECT 1 FROM public.banca b WHERE b.user_id = auth.uid()) as has_banca,
    EXISTS(SELECT 1 FROM public.entradas e WHERE e.user_id = auth.uid()) as has_entrada
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;

-- ============================================================================
-- 3. FUNÇÃO PARA MARCAR ONBOARDING COMO COMPLETO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET onboarding_completed = TRUE, updated_at = NOW()
  WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_onboarding() TO authenticated;

-- ============================================================================
-- 4. MARCAR USUÁRIOS EXISTENTES COM BANCA E ENTRADA COMO ONBOARDED
-- ============================================================================

UPDATE public.profiles p
SET onboarding_completed = TRUE
WHERE EXISTS (SELECT 1 FROM public.banca b WHERE b.user_id = p.id)
  AND EXISTS (SELECT 1 FROM public.entradas e WHERE e.user_id = p.id)
  AND (p.onboarding_completed IS NULL OR p.onboarding_completed = FALSE);

COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Indica se o usuário completou o onboarding inicial';
