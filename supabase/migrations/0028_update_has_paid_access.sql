-- Migration: tornar has_paid_access mais robusta (assinatura + pagamento)
-- Data: 2026-01-22
-- Objetivo:
-- - Considerar subscription_status (active/trialing) como acesso pago
-- - Manter compatibilidade com o fluxo antigo baseado em is_paid

CREATE OR REPLACE FUNCTION public.has_paid_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT;
BEGIN
  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.stripe_payments p
    WHERE lower(p.email) = jwt_email
      AND (
        p.is_paid = TRUE
        OR lower(coalesce(p.subscription_status, '')) IN ('active', 'trialing')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_paid_access() TO authenticated;

