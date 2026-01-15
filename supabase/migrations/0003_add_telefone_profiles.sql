-- Migration: Adicionar coluna telefone na tabela profiles
-- Data: 2025-01-XX
-- Descrição: Adiciona campo telefone para armazenar número de celular dos usuários

-- Adicionar coluna telefone se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'telefone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN telefone TEXT;
  END IF;
END $$;

-- Criar índice para telefone (opcional, útil para buscas)
CREATE INDEX IF NOT EXISTS idx_profiles_telefone ON public.profiles(telefone) WHERE telefone IS NOT NULL;

-- Comentário na coluna
COMMENT ON COLUMN public.profiles.telefone IS 'Número de telefone/celular do usuário';
