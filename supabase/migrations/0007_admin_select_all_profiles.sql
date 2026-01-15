-- Migration: Policy RLS para Admin SELECT em todas as linhas de profiles
-- Data: 2025-01-XX
-- Descrição: Garante que usuários com role = 'admin' possam executar SELECT em todas as linhas da tabela profiles

-- ============================================================================
-- REMOVER POLICY ANTIGA E RECRIAR COM VERIFICAÇÃO DIRETA
-- ============================================================================

-- Remover policy antiga se existir
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;

-- Criar nova policy que verifica diretamente na tabela profiles
-- Esta policy permite que admins vejam TODOS os perfis
CREATE POLICY "admin_select_all_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

-- ============================================================================
-- COMENTÁRIO E DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON POLICY "admin_select_all_profiles" ON public.profiles IS 
  'Permite que usuários com role = admin executem SELECT em todas as linhas da tabela profiles. 
   Verifica diretamente na tabela profiles se o usuário atual tem role = admin.';
