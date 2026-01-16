-- Criar tabela BANCA
CREATE TABLE IF NOT EXISTS public.banca (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT banca_user_id_unique UNIQUE (user_id)
);

-- Adicionar coluna valor se não existir
ALTER TABLE public.banca ADD COLUMN IF NOT EXISTS valor DECIMAL(10, 2);
UPDATE public.banca SET valor = 0 WHERE valor IS NULL;
ALTER TABLE public.banca ALTER COLUMN valor SET NOT NULL;
ALTER TABLE public.banca ALTER COLUMN valor SET DEFAULT 0;

-- Criar tabela ENTRADAS
CREATE TABLE IF NOT EXISTS public.entradas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stake_percent DECIMAL(5, 2) NOT NULL,
  valor_stake DECIMAL(10, 2) NOT NULL,
  odd DECIMAL(5, 2) NOT NULL,
  mercado VARCHAR(100),
  resultado VARCHAR(10) CHECK (resultado IN ('green', 'red', 'pendente')),
  valor_resultado DECIMAL(10, 2),
  observacoes TEXT,
  favorita BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adiciona campo mercado se não existir
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS mercado VARCHAR(100);

-- Adiciona campo favorita se não existir
ALTER TABLE public.entradas ADD COLUMN IF NOT EXISTS favorita BOOLEAN;
UPDATE public.entradas SET favorita = FALSE WHERE favorita IS NULL;
ALTER TABLE public.entradas ALTER COLUMN favorita SET DEFAULT FALSE;
ALTER TABLE public.entradas ALTER COLUMN favorita SET NOT NULL;

-- Criar indices
CREATE INDEX IF NOT EXISTS idx_banca_user_id ON public.banca(user_id);
CREATE INDEX IF NOT EXISTS idx_entradas_user_id ON public.entradas(user_id);
CREATE INDEX IF NOT EXISTS idx_entradas_created_at ON public.entradas(created_at);

-- Habilitar RLS
ALTER TABLE public.banca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;

-- Políticas para BANCA
DROP POLICY IF EXISTS "banca_select" ON public.banca;
DROP POLICY IF EXISTS "banca_insert" ON public.banca;
DROP POLICY IF EXISTS "banca_update" ON public.banca;

CREATE POLICY "banca_select" ON public.banca FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "banca_insert" ON public.banca FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "banca_update" ON public.banca FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para ENTRADAS
DROP POLICY IF EXISTS "entradas_select" ON public.entradas;
DROP POLICY IF EXISTS "entradas_insert" ON public.entradas;
DROP POLICY IF EXISTS "entradas_update" ON public.entradas;
DROP POLICY IF EXISTS "entradas_delete" ON public.entradas;

CREATE POLICY "entradas_select" ON public.entradas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "entradas_insert" ON public.entradas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entradas_update" ON public.entradas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "entradas_delete" ON public.entradas FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Stakes personalizadas (% da banca) por usuário
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.stakes_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'stake',
  percent NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stakes_personalizadas_percent_chk CHECK (percent > 0 AND percent <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS stakes_personalizadas_unique_user_percent
  ON public.stakes_personalizadas (user_id, percent);

CREATE INDEX IF NOT EXISTS idx_stakes_personalizadas_user_id
  ON public.stakes_personalizadas (user_id);

ALTER TABLE public.stakes_personalizadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stakes_personalizadas_select_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_insert_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_update_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_delete_own" ON public.stakes_personalizadas;

CREATE POLICY "stakes_personalizadas_select_own"
ON public.stakes_personalizadas
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "stakes_personalizadas_insert_own"
ON public.stakes_personalizadas
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "stakes_personalizadas_update_own"
ON public.stakes_personalizadas
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "stakes_personalizadas_delete_own"
ON public.stakes_personalizadas
FOR DELETE
USING (user_id = auth.uid());
