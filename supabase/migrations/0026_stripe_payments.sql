-- Migration: Stripe payments mapping + acesso pago
-- Data: 2026-01-22
-- Objetivo:
-- - registrar pagamentos do Stripe por email (checkout.session.completed)
-- - permitir checagem simples de acesso pago via RPC has_paid_access()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.stripe_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  checkout_session_id TEXT,
  payment_status TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_payments_email_unique
  ON public.stripe_payments (lower(email));

CREATE INDEX IF NOT EXISTS stripe_payments_paid_at_desc
  ON public.stripe_payments (paid_at DESC);

ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;

-- (Opcional) Sem policies: apenas service role consegue escrever/ler direto.

-- Função: checa se o usuário autenticado tem pagamento confirmado
CREATE OR REPLACE FUNCTION public.has_paid_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT;
BEGIN
  -- JWT normalmente contém email
  jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF jwt_email = '' THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.stripe_payments p
    WHERE lower(p.email) = jwt_email
      AND p.is_paid = TRUE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_paid_access() TO authenticated;

