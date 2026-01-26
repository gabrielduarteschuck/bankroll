-- Migration: Adicionar coluna is_archived para sistema de arquivamento
-- Data: 2026-01-26
-- Objetivo: Permitir que sugestões e múltiplas sejam arquivadas ao invés de deletadas

-- ============================================================================
-- 1. ADICIONAR COLUNA is_archived NA TABELA AI_SUGGESTIONS
-- ============================================================================

ALTER TABLE public.ai_suggestions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_archived ON public.ai_suggestions(is_archived);

COMMENT ON COLUMN public.ai_suggestions.is_archived IS 'Se true, a sugestão está arquivada e não aparece para usuários';

-- ============================================================================
-- 2. ADICIONAR COLUNA is_archived NA TABELA MULTIPLAS
-- ============================================================================

ALTER TABLE public.multiplas
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_multiplas_archived ON public.multiplas(is_archived);

COMMENT ON COLUMN public.multiplas.is_archived IS 'Se true, a múltipla está arquivada e não aparece para usuários';

-- ============================================================================
-- 3. ATUALIZAR POLÍTICA RLS PARA FILTRAR ARQUIVADAS (USUÁRIOS NORMAIS)
-- ============================================================================

-- Remover política antiga de múltiplas para usuários
DROP POLICY IF EXISTS "multiplas_select_published" ON public.multiplas;

-- Nova política: Usuários autenticados podem ver múltiplas publicadas E não arquivadas
CREATE POLICY "multiplas_select_published_not_archived" ON public.multiplas
  FOR SELECT
  TO authenticated
  USING (
    is_published = TRUE
    AND is_archived = FALSE
  );

-- Nota: Para ai_suggestions, a RLS já permite select para authenticated.
-- O filtro de is_archived é feito na query do frontend.

-- ============================================================================
-- 4. GARANTIR QUE ADMIN PODE VER TUDO (incluindo arquivadas)
-- ============================================================================

-- A política multiplas_admin_all já permite tudo para admin,
-- então não precisa de alteração.

-- Verificar se há política admin para ai_suggestions
-- Se não existir, criar uma que permite admin ver todas
DO $$
BEGIN
  -- Criar política de admin para ai_suggestions se não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'ai_suggestions'
    AND policyname = 'ai_suggestions_admin_all'
  ) THEN
    CREATE POLICY "ai_suggestions_admin_all" ON public.ai_suggestions
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
        OR
        auth.jwt() ->> 'email' = 'duarte.schuck@icloud.com'
      );
  END IF;
END $$;
