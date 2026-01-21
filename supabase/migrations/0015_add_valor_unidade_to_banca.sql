-- Migration: adicionar valor da unidade (R$) em public.banca (idempotente)
-- Data: 2026-01-16
-- Objetivo:
-- - stake passa a ser "unidades"
-- - usuário define quanto vale 1 unidade em R$

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banca'
      AND column_name = 'valor_unidade'
  ) THEN
    ALTER TABLE public.banca
      ADD COLUMN valor_unidade NUMERIC;
  END IF;
END $$;

-- Backfill: por padrão, 1 unidade = 1% da base (stake_base se existir; senão valor)
UPDATE public.banca
SET valor_unidade = (COALESCE(stake_base, valor) * 0.01)
WHERE valor_unidade IS NULL OR valor_unidade <= 0;

ALTER TABLE public.banca
  ALTER COLUMN valor_unidade SET DEFAULT 0;

