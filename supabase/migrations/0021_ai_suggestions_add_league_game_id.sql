-- Migration: adicionar league e game_id em public.ai_suggestions (idempotente)
-- Data: 2026-01-20
-- Objetivo:
-- - suportar confrontos automáticos (NBA/league + game_id)
-- - não remover/renomear campos existentes

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_suggestions'
      AND column_name = 'league'
  ) THEN
    ALTER TABLE public.ai_suggestions
      ADD COLUMN league TEXT NOT NULL DEFAULT 'NBA';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_suggestions'
      AND column_name = 'game_id'
  ) THEN
    ALTER TABLE public.ai_suggestions
      ADD COLUMN game_id TEXT;
  END IF;
END $$;

-- Backfill seguro (caso a coluna exista mas esteja NULL por algum motivo)
UPDATE public.ai_suggestions
SET league = 'NBA'
WHERE league IS NULL OR btrim(league) = '';

-- Reforça default e NOT NULL (idempotente)
ALTER TABLE public.ai_suggestions
  ALTER COLUMN league SET DEFAULT 'NBA';

ALTER TABLE public.ai_suggestions
  ALTER COLUMN league SET NOT NULL;

-- Índice para lookup por confronto
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_league_game_id
  ON public.ai_suggestions (league, game_id);

