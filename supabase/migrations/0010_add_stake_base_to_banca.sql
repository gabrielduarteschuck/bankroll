-- Migration: separar banca inicial (imutável) da base de stake (reajustável)
-- Objetivo:
-- - manter public.banca.valor como "banca inicial" (primeira banca do lead)
-- - adicionar public.banca.stake_base como base para cálculo de stakes (pode ser reajustada)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banca'
      AND column_name = 'stake_base'
  ) THEN
    ALTER TABLE public.banca
      ADD COLUMN stake_base NUMERIC;
  END IF;
END $$;

-- Backfill: se stake_base ainda não existir para registros antigos, usar o valor inicial
UPDATE public.banca
SET stake_base = valor
WHERE stake_base IS NULL;

