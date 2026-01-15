-- Script FORÇADO para definir usuário como admin
-- Execute este script no Supabase SQL Editor
-- Este script contorna RLS usando SECURITY DEFINER

-- ============================================================================
-- 1. CRIAR FUNÇÃO TEMPORÁRIA QUE CONTORNA RLS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.force_set_admin_role(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_id_found UUID;
BEGIN
  -- Busca o ID do usuário pelo email
  SELECT id INTO user_id_found
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  IF user_id_found IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado', user_email;
  END IF;
  
  -- Atualiza ou cria o profile com role admin
  INSERT INTO public.profiles (id, email, role, created_at)
  SELECT 
    user_id_found,
    user_email,
    'admin',
    COALESCE((SELECT created_at FROM auth.users WHERE id = user_id_found), NOW())
  ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- 2. EXECUTAR A FUNÇÃO PARA DEFINIR COMO ADMIN
-- ============================================================================

SELECT public.force_set_admin_role('duarte.schuck@icloud.com');

-- ============================================================================
-- 3. VERIFICAR SE FOI ATUALIZADO
-- ============================================================================

SELECT id, email, role, created_at
FROM public.profiles
WHERE email = 'duarte.schuck@icloud.com';

-- ============================================================================
-- 4. LIMPAR: REMOVER FUNÇÃO TEMPORÁRIA (OPCIONAL)
-- ============================================================================

-- DROP FUNCTION IF EXISTS public.force_set_admin_role(TEXT);
