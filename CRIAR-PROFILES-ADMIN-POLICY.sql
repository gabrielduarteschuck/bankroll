-- Política adicional para permitir que admins vejam todos os perfis
-- Esta política será verificada no código da aplicação
-- Por enquanto, vamos criar uma função que verifica se o usuário é admin

-- Função para verificar se um email é admin
-- Nota: A lista de admins deve ser configurada via variável de ambiente ADMIN_EMAILS
-- Esta função é apenas um exemplo - a verificação real será feita no middleware

-- Política alternativa: permitir SELECT para todos (apenas para desenvolvimento)
-- ATENÇÃO: Em produção, use uma abordagem mais segura com service_role ou função específica

-- Opção 1: Política que permite admins verem todos (requer função de verificação)
-- Esta abordagem requer criar uma função no Supabase que verifica a whitelist
-- Por enquanto, vamos usar uma política mais simples para desenvolvimento

-- Política temporária: permitir que usuários autenticados vejam todos os perfis
-- ATENÇÃO: Apenas para desenvolvimento. Em produção, use service_role key ou função específica
DROP POLICY IF EXISTS "profiles_select_all_for_admins" ON public.profiles;
CREATE POLICY "profiles_select_all_for_admins" ON public.profiles 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Nota: Para produção, recomenda-se:
-- 1. Usar service_role key no backend para buscar perfis
-- 2. Ou criar uma função RPC que verifica a whitelist de admins
-- 3. Ou usar uma tabela separada de admins e verificar via função
