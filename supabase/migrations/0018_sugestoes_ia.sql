-- Migration: tabela public.sugestoes_ia + RLS (publicado para usuários, admin gerencia)
-- Data: 2026-01-20
-- Objetivo:
-- - armazenar sugestões analisadas pela IA
-- - exibir apenas publicadas para usuários autenticados
-- - permitir CRUD apenas para admin (via profiles.is_admin = true)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1) Garantir coluna profiles.is_admin (boolean) para marcar admins
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'is_admin'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
  END IF;
END $$;

-- Mantém compatibilidade com o modelo antigo (role) e o novo (is_admin)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND (
        role = 'admin'
        OR COALESCE(is_admin, FALSE) = TRUE
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2) Tabela public.sugestoes_ia
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sugestoes_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  titulo TEXT NOT NULL,
  esporte TEXT NOT NULL,
  evento TEXT NOT NULL,
  mercado TEXT NOT NULL,
  odd NUMERIC NOT NULL,
  confianca_pct INT NOT NULL,
  resumo TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  link_casa TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT sugestoes_ia_confianca_pct_chk CHECK (confianca_pct >= 0 AND confianca_pct <= 100)
);

CREATE INDEX IF NOT EXISTS idx_sugestoes_ia_is_published
  ON public.sugestoes_ia (is_published);

CREATE INDEX IF NOT EXISTS idx_sugestoes_ia_published_at_desc
  ON public.sugestoes_ia (published_at DESC);

ALTER TABLE public.sugestoes_ia ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3) RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "sugestoes_ia_select_published" ON public.sugestoes_ia;
DROP POLICY IF EXISTS "sugestoes_ia_admin_all" ON public.sugestoes_ia;

-- Usuário autenticado: pode ver apenas sugestões publicadas
CREATE POLICY "sugestoes_ia_select_published"
ON public.sugestoes_ia
FOR SELECT
TO authenticated
USING (is_published = TRUE);

-- Admin: pode fazer tudo (SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "sugestoes_ia_admin_all"
ON public.sugestoes_ia
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

