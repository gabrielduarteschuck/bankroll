-- Migration: adicionar home_team e away_team em public.ai_suggestions (idempotente)
-- Data: 2026-01-21
-- Objetivo:
-- - armazenar códigos dos times (ex: "lal", "bos") para uso com logos locais (NBA_LOGOS)
-- - não remover/renomear campos existentes

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_suggestions'
      AND column_name = 'home_team'
  ) THEN
    ALTER TABLE public.ai_suggestions
      ADD COLUMN home_team TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_suggestions'
      AND column_name = 'away_team'
  ) THEN
    ALTER TABLE public.ai_suggestions
      ADD COLUMN away_team TEXT;
  END IF;
END $$;

