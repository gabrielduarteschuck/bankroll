-- Adiciona coluna favorita à tabela apostas_multiplas
ALTER TABLE public.apostas_multiplas
ADD COLUMN IF NOT EXISTS favorita BOOLEAN;

-- Define valor padrão como FALSE
ALTER TABLE public.apostas_multiplas
ALTER COLUMN favorita SET DEFAULT FALSE;

-- Atualiza registros existentes para FALSE
UPDATE public.apostas_multiplas
SET favorita = FALSE
WHERE favorita IS NULL;

-- Torna a coluna NOT NULL após preencher os valores
ALTER TABLE public.apostas_multiplas
ALTER COLUMN favorita SET NOT NULL;

-- Índice para performance em filtros de favoritas
CREATE INDEX IF NOT EXISTS idx_apostas_multiplas_user_favorita
  ON public.apostas_multiplas (user_id, favorita);
