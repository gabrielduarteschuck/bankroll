-- Migration: Garantir trigger de profiles e função de sincronização
-- Data: 2025-01-XX
-- Descrição: Garante que trigger existe e created_at vem de auth.users, cria função de re-sincronização

-- ============================================================================
-- 1. GARANTIR QUE handle_new_user USA created_at DE auth.users
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
  -- IMPORTANTE: created_at vem de auth.users.created_at (NEW.created_at)
  INSERT INTO public.profiles (id, email, telefone, role, created_at)
  VALUES (
    NEW.id,
    user_email,
    user_telefone, -- Pode ser NULL
    COALESCE(existing_role, 'user'), -- Mantém role existente ou cria como 'user'
    NEW.created_at -- SEMPRE usa created_at de auth.users
  )
  ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      telefone = COALESCE(EXCLUDED.telefone, public.profiles.telefone),
      updated_at = NOW();
      -- Não atualiza created_at no UPDATE (mantém o original)
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro mas não bloqueia a criação do usuário
    RAISE WARNING 'Erro ao criar profile para usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. GARANTIR QUE O TRIGGER EXISTE
-- ============================================================================

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar trigger AFTER INSERT ON auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. FUNÇÃO RPC PARA RE-SINCRONIZAR PERFIS FALTANTES (ADMIN ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_missing_profiles()
RETURNS TABLE (
  synced_count INTEGER,
  total_checked INTEGER,
  errors TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  user_email TEXT;
  synced INTEGER := 0;
  checked INTEGER := 0;
  error_list TEXT[] := ARRAY[]::TEXT[];
  current_user_role TEXT;
BEGIN
  -- Verificar se o usuário atual é admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF current_user_role != 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem executar esta função';
  END IF;
  
  -- Iterar sobre todos os usuários em auth.users que não têm profile
  FOR user_record IN 
    SELECT 
      au.id,
      au.raw_user_meta_data,
      au.raw_app_meta_data,
      au.created_at
    FROM auth.users au
    WHERE au.id NOT IN (
      SELECT id FROM public.profiles WHERE id IS NOT NULL
    )
  LOOP
    checked := checked + 1;
    
    BEGIN
      -- Extrai email do JSON metadata
      user_email := user_record.raw_user_meta_data->>'email';
      
      IF user_email IS NULL OR user_email = '' THEN
        user_email := user_record.raw_app_meta_data->>'email';
      END IF;
      
      IF user_email IS NULL OR user_email = '' THEN
        user_email := 'sem-email@exemplo.com';
      END IF;
      
      -- Insere profile usando created_at de auth.users
      INSERT INTO public.profiles (id, email, role, created_at)
      VALUES (
        user_record.id,
        user_email,
        'user', -- Novos perfis sincronizados começam como 'user'
        COALESCE(user_record.created_at, NOW())
      )
      ON CONFLICT (id) DO NOTHING;
      
      synced := synced + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_list := array_append(error_list, 
          format('Erro ao sincronizar usuário %s: %s', user_record.id, SQLERRM)
        );
    END;
  END LOOP;
  
  RETURN QUERY SELECT synced, checked, error_list;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.sync_missing_profiles() IS 
  'Re-sincroniza perfis faltantes. Apenas admins podem executar. Retorna contagem de sincronizados e erros.';

-- ============================================================================
-- 4. VERIFICAÇÃO: Garantir que trigger existe
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
    AND tgrelid = 'auth.users'::regclass
  ) THEN
    RAISE WARNING 'Trigger on_auth_user_created não encontrado em auth.users';
  END IF;
END $$;
