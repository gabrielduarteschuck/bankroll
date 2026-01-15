-- Migration: Função para buscar usuários com status de verificação
-- Data: 2025-01-XX
-- Descrição: Cria função RPC para listar usuários com informação de email verificado

-- ============================================================================
-- FUNÇÃO: Buscar usuários com status de verificação de email
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_users_with_verification()
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  email_verified BOOLEAN,
  email_confirmed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.role,
    p.created_at,
    COALESCE(au.email_confirmed_at IS NOT NULL, false) as email_verified,
    au.email_confirmed_at
  FROM public.profiles p
  LEFT JOIN auth.users au ON p.id = au.id
  WHERE p.email != 'sem-email@exemplo.com' -- Filtra emails inválidos
  ORDER BY p.created_at DESC;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.get_users_with_verification() IS 
  'Retorna lista de usuários com status de verificação de email. Filtra emails inválidos.';
