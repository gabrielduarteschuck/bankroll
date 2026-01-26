-- Migration: Sistema de Múltiplas e Upload de Imagens
-- Data: 2026-01-26
-- Objetivo: Adicionar tabela de múltiplas e suporte a imagens nas sugestões

-- ============================================================================
-- 1. ADICIONAR COLUNA DE IMAGEM NA TABELA AI_SUGGESTIONS
-- ============================================================================

ALTER TABLE public.ai_suggestions
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.ai_suggestions.image_url IS 'URL da imagem da sugestão (opcional)';

-- ============================================================================
-- 2. CRIAR TABELA DE MÚLTIPLAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.multiplas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  odd_total NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  quantidade_jogos INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  link_bilhete TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_multiplas_published ON public.multiplas(is_published);
CREATE INDEX IF NOT EXISTS idx_multiplas_created_at ON public.multiplas(created_at DESC);

-- RLS
ALTER TABLE public.multiplas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver múltiplas publicadas
CREATE POLICY "multiplas_select_published" ON public.multiplas
  FOR SELECT
  TO authenticated
  USING (is_published = TRUE);

-- Política: Admins podem fazer tudo
CREATE POLICY "multiplas_admin_all" ON public.multiplas
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

COMMENT ON TABLE public.multiplas IS 'Tabela de múltiplas geradas por especialistas';

-- ============================================================================
-- 3. CRIAR STORAGE BUCKET PARA IMAGENS (se não existir)
-- ============================================================================

-- Nota: O bucket precisa ser criado via Dashboard do Supabase ou CLI
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON public.multiplas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.multiplas TO authenticated;
