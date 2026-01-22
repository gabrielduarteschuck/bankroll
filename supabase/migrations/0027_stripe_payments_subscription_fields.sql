-- Migration: adicionar campos de assinatura em stripe_payments (idempotente)
-- Data: 2026-01-22
-- Objetivo:
-- - registrar subscription_id/status e último invoice para permitir controle de acesso por assinatura

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_payments' AND column_name='subscription_id'
  ) THEN
    ALTER TABLE public.stripe_payments ADD COLUMN subscription_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_payments' AND column_name='subscription_status'
  ) THEN
    ALTER TABLE public.stripe_payments ADD COLUMN subscription_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_payments' AND column_name='last_invoice_id'
  ) THEN
    ALTER TABLE public.stripe_payments ADD COLUMN last_invoice_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_payments' AND column_name='current_period_end'
  ) THEN
    ALTER TABLE public.stripe_payments ADD COLUMN current_period_end TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stripe_payments' AND column_name='cancel_at_period_end'
  ) THEN
    ALTER TABLE public.stripe_payments ADD COLUMN cancel_at_period_end BOOLEAN;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stripe_payments_customer_id_idx
  ON public.stripe_payments (stripe_customer_id);

CREATE INDEX IF NOT EXISTS stripe_payments_subscription_id_idx
  ON public.stripe_payments (subscription_id);

