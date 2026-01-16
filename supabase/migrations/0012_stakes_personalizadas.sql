-- Migration: stakes personalizadas (% da banca) por usuário
-- Data: 2026-01-16
-- Objetivo:
-- - permitir o usuário criar stakes personalizadas (percentual) e reutilizar ao registrar entradas
-- - nome padrão: "stake"
-- - RLS: usuário só vê/insere/edita/deleta as próprias stakes; admin pode acessar tudo

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

-- Evita duplicar a mesma % por usuário
CREATE UNIQUE INDEX IF NOT EXISTS stakes_personalizadas_unique_user_percent
  ON public.stakes_personalizadas (user_id, percent);

CREATE INDEX IF NOT EXISTS idx_stakes_personalizadas_user_id
  ON public.stakes_personalizadas (user_id);

ALTER TABLE public.stakes_personalizadas ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas (idempotente)
DROP POLICY IF EXISTS "stakes_personalizadas_select_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_insert_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_update_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_delete_own" ON public.stakes_personalizadas;
DROP POLICY IF EXISTS "stakes_personalizadas_admin_all" ON public.stakes_personalizadas;

-- Usuário autenticado: SELECT apenas suas stakes
CREATE POLICY "stakes_personalizadas_select_own"
ON public.stakes_personalizadas
FOR SELECT
USING (user_id = auth.uid());

-- Usuário autenticado: INSERT apenas para si mesmo
CREATE POLICY "stakes_personalizadas_insert_own"
ON public.stakes_personalizadas
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Usuário autenticado: UPDATE apenas suas stakes
CREATE POLICY "stakes_personalizadas_update_own"
ON public.stakes_personalizadas
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Usuário autenticado: DELETE apenas suas stakes
CREATE POLICY "stakes_personalizadas_delete_own"
ON public.stakes_personalizadas
FOR DELETE
USING (user_id = auth.uid());

-- Admin: acesso total
CREATE POLICY "stakes_personalizadas_admin_all"
ON public.stakes_personalizadas
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

