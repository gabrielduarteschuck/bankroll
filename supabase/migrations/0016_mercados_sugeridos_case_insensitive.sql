-- Migration: impedir duplicados (case-insensitive) em mercados_sugeridos
-- Data: 2026-01-16
-- Objetivo:
-- - usuário não pode ter o mesmo mercado repetido por esporte, ignorando maiúsculas/minúsculas
-- - manter compatibilidade com a tabela existente

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'mercados_sugeridos'
      AND column_name = 'mercado_norm'
  ) THEN
    ALTER TABLE public.mercados_sugeridos
      ADD COLUMN mercado_norm TEXT;
  END IF;
END $$;

-- Backfill da normalização (trim + lower)
UPDATE public.mercados_sugeridos
SET mercado_norm = lower(btrim(mercado))
WHERE (mercado_norm IS NULL OR mercado_norm = '')
  AND mercado IS NOT NULL
  AND btrim(mercado) <> '';

-- Remove duplicados (mantém o registro mais recente por user+esporte+mercado_norm)
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, esporte, mercado_norm
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.mercados_sugeridos
  WHERE mercado_norm IS NOT NULL
    AND mercado_norm <> ''
)
DELETE FROM public.mercados_sugeridos ms
USING ranked r
WHERE ms.id = r.id
  AND r.rn > 1;

-- Índice único case-insensitive (por usuário + esporte)
CREATE UNIQUE INDEX IF NOT EXISTS mercados_sugeridos_unique_user_esporte_mercado_norm
  ON public.mercados_sugeridos (user_id, esporte, mercado_norm);

