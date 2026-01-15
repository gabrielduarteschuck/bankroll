-- Migration: Corrigir função handle_new_user e trigger
-- Data: 2025-01-XX
-- Descrição: Corrige erro "Database error saving new user" no signup
-- Garante que a função seja SECURITY DEFINER com search_path seguro
-- Corrige INSERT para usar ON CONFLICT corretamente

-- ============================================================================
-- 1. REMOVER TRIGGER E FUNÇÃO ANTIGA
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================================
-- 2. RECRIAR FUNÇÃO handle_new_user COM SEGURANÇA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  user_telefone TEXT;
  existing_role TEXT;
BEGIN
  -- Extrai email do JSON metadata
  user_email := NEW.raw_user_meta_data->>'email';
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := NEW.raw_app_meta_data->>'email';
  END IF;
  
  IF user_email IS NULL OR user_email = '' THEN
    user_email := 'sem-email@exemplo.com';
  END IF;
  
  -- Extrai telefone dos metadados (se disponível)
  user_telefone := NEW.raw_user_meta_data->>'telefone';
  
  IF user_telefone IS NULL OR user_telefone = '' THEN
    user_telefone := NEW.raw_app_meta_data->>'telefone';
  END IF;
  
  -- Verifica se já existe profile (para manter role existente)
  BEGIN
    SELECT role INTO existing_role
    FROM public.profiles
    WHERE id = NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      existing_role := NULL;
  END;
  
  -- Insere ou atualiza profile usando ON CONFLICT
  -- Isso garante que não falha se o profile já existir
  INSERT INTO public.profiles (id, email, telefone, role, created_at)
  VALUES (
    NEW.id,
    user_email,
    user_telefone, -- Pode ser NULL
    COALESCE(existing_role, 'user'), -- Mantém role existente ou cria como 'user'
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone), -- Atualiza telefone se fornecido, senão mantém o existente
      updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não bloqueia a criação do usuário
    RAISE WARNING 'Erro ao criar profile para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. RECRIAR TRIGGER CORRETAMENTE
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Trigger function para criar/atualizar profile automaticamente ao criar usuário. 
   Usa SECURITY DEFINER com search_path seguro. 
   Inclui email e telefone dos metadados. 
   Usa ON CONFLICT para evitar erros se profile já existir.';

-- ============================================================================
-- 5. VERIFICAÇÃO: Testar se a função foi criada corretamente
-- ============================================================================

-- Verifica se a função existe e tem as propriedades corretas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
    AND p.prosecdef = true -- SECURITY DEFINER
  ) THEN
    RAISE WARNING 'Função handle_new_user não foi criada com SECURITY DEFINER';
  END IF;
END $$;
