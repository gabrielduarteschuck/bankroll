-- Migration: adicionar flag de favorito em public.entradas (idempotente)
-- Data: 2026-01-16
-- Objetivo:
-- - permitir marcar entradas como favoritas

ALTER TABLE public.entradas
ADD COLUMN IF NOT EXISTS favorita BOOLEAN;

-- Backfill seguro
UPDATE public.entradas
SET favorita = FALSE
WHERE favorita IS NULL;

ALTER TABLE public.entradas
ALTER COLUMN favorita SET DEFAULT FALSE;

ALTER TABLE public.entradas
ALTER COLUMN favorita SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entradas_user_favorita
  ON public.entradas (user_id, favorita);

