-- Migration: Admin pode gerenciar pagamentos de usuários
-- Data: 2026-01-25
-- Objetivo:
-- - Criar função RPC para admin alterar status de pagamento
-- - Adicionar políticas RLS para admin em stripe_payments

-- ============================================================================
-- 1. POLÍTICAS RLS PARA ADMIN EM stripe_payments
-- ============================================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "stripe_payments_admin_select" ON public.stripe_payments;
DROP POLICY IF EXISTS "stripe_payments_admin_update" ON public.stripe_payments;
DROP POLICY IF EXISTS "stripe_payments_admin_insert" ON public.stripe_payments;

-- Admin pode SELECT em stripe_payments
CREATE POLICY "stripe_payments_admin_select" ON public.stripe_payments
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admin pode UPDATE em stripe_payments
CREATE POLICY "stripe_payments_admin_update" ON public.stripe_payments
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin pode INSERT em stripe_payments
CREATE POLICY "stripe_payments_admin_insert" ON public.stripe_payments
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- 2. FUNÇÃO RPC: admin_set_user_paid_status
-- ============================================================================

-- Remove função antiga se existir
DROP FUNCTION IF EXISTS public.admin_set_user_paid_status(TEXT, BOOLEAN);

-- Cria função para admin alterar status de pagamento
CREATE OR REPLACE FUNCTION public.admin_set_user_paid_status(
  target_email TEXT,
  new_is_paid BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin BOOLEAN;
  normalized_email TEXT;
BEGIN
  -- Verifica se o chamador é admin
  caller_is_admin := public.is_admin(auth.uid());

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar status de pagamento.';
  END IF;

  -- Normaliza o email para minúsculas
  normalized_email := lower(trim(target_email));

  IF normalized_email = '' OR normalized_email IS NULL THEN
    RAISE EXCEPTION 'Email inválido.';
  END IF;

  -- Upsert em stripe_payments
  INSERT INTO public.stripe_payments (
    email,
    is_paid,
    subscription_status,
    paid_at,
    updated_at
  )
  VALUES (
    normalized_email,
    new_is_paid,
    CASE WHEN new_is_paid THEN 'active' ELSE 'canceled' END,
    CASE WHEN new_is_paid THEN now() ELSE NULL END,
    now()
  )
  ON CONFLICT (lower(email))
  DO UPDATE SET
    is_paid = new_is_paid,
    subscription_status = CASE WHEN new_is_paid THEN 'active' ELSE 'canceled' END,
    paid_at = CASE WHEN new_is_paid THEN COALESCE(stripe_payments.paid_at, now()) ELSE stripe_payments.paid_at END,
    updated_at = now();

  RETURN TRUE;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.admin_set_user_paid_status(TEXT, BOOLEAN) IS
  'Permite admin alterar status de pagamento de qualquer usuário via upsert em stripe_payments.';

-- Conceder permissão para usuários autenticados executarem (a função verifica se é admin internamente)
GRANT EXECUTE ON FUNCTION public.admin_set_user_paid_status(TEXT, BOOLEAN) TO authenticated;

-- ============================================================================
-- RESUMO:
-- ============================================================================
-- 1. Políticas RLS permitem admin SELECT/UPDATE/INSERT em stripe_payments
-- 2. Função admin_set_user_paid_status faz upsert seguro
-- 3. Apenas admins (verificados via is_admin) podem executar alterações
-- ============================================================================
