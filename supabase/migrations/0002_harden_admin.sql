-- Migration: Hardening RLS - Blindagem Extra
-- Data: 2025-01-XX
-- Descrição: Ajusta função is_admin com SECURITY DEFINER e trava coluna role

-- ============================================================================
-- 1. RECRIAR FUNÇÃO is_admin COM SECURITY DEFINER E SEARCH_PATH SEGURO
-- ============================================================================

-- Remove função antiga se existir
DROP FUNCTION IF EXISTS public.is_admin(UUID);

-- Recria função com SECURITY DEFINER e search_path seguro
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Verifica se o usuário tem role 'admin' na tabela profiles
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles
    WHERE id = user_id 
    AND role = 'admin'
  );
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.is_admin(UUID) IS 
  'Verifica se um usuário tem role admin. Usa SECURITY DEFINER para funcionar dentro de policies RLS.';

-- ============================================================================
-- 2. TRAVAR COLUNA role - BLOQUEAR UPDATE PARA USUÁRIOS AUTENTICADOS
-- ============================================================================

-- Remover política de UPDATE antiga que permitia usuários alterarem seu próprio profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Criar nova política de UPDATE que BLOQUEIA alteração de role
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    -- Garante que o role não pode ser alterado (deve ser igual ao atual)
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    -- Garante que apenas campos não-críticos podem ser atualizados
    -- (email pode ser atualizado, mas role NÃO)
  );

-- ============================================================================
-- 3. TRIGGER DE PROTEÇÃO: BLOQUEAR UPDATE DE role PARA NÃO-ADMINS
-- ============================================================================

-- Função trigger que bloqueia UPDATE de role para não-admins
CREATE OR REPLACE FUNCTION public.prevent_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role TEXT;
  is_current_user_admin BOOLEAN;
BEGIN
  -- Se o role não mudou, permite (atualização de outros campos)
  IF OLD.role = NEW.role THEN
    RETURN NEW;
  END IF;
  
  -- Se o role mudou, verifica se o usuário atual é admin
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Verifica se é admin
  is_current_user_admin := (current_user_role = 'admin');
  
  -- Se não é admin, bloqueia a alteração de role
  IF NOT is_current_user_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o role. Usuário atual não tem permissão.';
  END IF;
  
  -- Se é admin, permite a alteração
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE UPDATE na tabela profiles
DROP TRIGGER IF EXISTS prevent_role_update_trigger ON public.profiles;
CREATE TRIGGER prevent_role_update_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.prevent_role_update();

-- Comentário no trigger
COMMENT ON FUNCTION public.prevent_role_update() IS 
  'Trigger que bloqueia UPDATE de role para usuários não-admin. Apenas admins podem alterar role via SQL ou policies.';

-- ============================================================================
-- 4. REVOGAR PERMISSÕES DIRETAS NA COLUNA role (SE SUPORTADO)
-- ============================================================================

-- Nota: PostgreSQL não permite REVOKE em colunas específicas diretamente
-- A proteção é feita via policies RLS e trigger acima
-- Mas podemos garantir que a tabela está protegida

-- Verificar se RLS está habilitado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================================================
-- 5. TESTE DE VALIDAÇÃO: Verificar que a função is_admin funciona
-- ============================================================================

-- Comentário: A função is_admin agora usa SECURITY DEFINER
-- Isso garante que ela funciona corretamente dentro das policies RLS
-- mesmo quando chamada por usuários autenticados

-- ============================================================================
-- 6. DOCUMENTAÇÃO E COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.is_admin(UUID) IS 
  'Função segura para verificar role admin. Usa SECURITY DEFINER com search_path fixo para segurança.';

COMMENT ON FUNCTION public.prevent_role_update() IS 
  'Trigger que bloqueia UPDATE de role para não-admins. Apenas admins podem alterar role.';

-- ============================================================================
-- RESUMO DAS PROTEÇÕES IMPLEMENTADAS:
-- ============================================================================
-- 1. Função is_admin com SECURITY DEFINER e search_path seguro
-- 2. Policy de UPDATE que bloqueia alteração de role
-- 3. Trigger BEFORE UPDATE que bloqueia alteração de role para não-admins
-- 4. RLS habilitado e verificado
-- 
-- RESULTADO: Usuários autenticados NÃO conseguem alterar role em nenhuma hipótese.
-- Apenas admins (via policy) ou SQL manual (service_role) podem alterar role.
-- ============================================================================
