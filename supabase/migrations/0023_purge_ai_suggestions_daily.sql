-- Migration: limpar (excluir) sugestões da IA diariamente às 02:00
-- Data: 2026-01-21
-- Objetivo:
-- - excluir todas as linhas de public.ai_suggestions todos os dias
-- - (ai_suggestions_votes será limpo via ON DELETE CASCADE)
--
-- Observação de fuso horário:
-- - O banco do Supabase normalmente roda em UTC.
-- - 02:00 (America/Sao_Paulo, BRT UTC-3) = 05:00 UTC.
-- - Por isso o cron abaixo é 05:00 UTC.

-- 1) Função de purge (idempotente)
CREATE OR REPLACE FUNCTION public.purge_ai_suggestions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_suggestions;
$$;

-- 2) Habilitar pg_cron se disponível (idempotente e com fallback)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      -- Em muitos projetos Supabase, extensões ficam no schema "extensions"
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions';
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        -- fallback: tenta sem schema
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
      EXCEPTION WHEN OTHERS THEN
        -- pg_cron pode não estar disponível no seu plano/projeto
        NULL;
      END;
    END;
  END IF;
END $$;

-- 3) Agendar job diário (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- remove job antigo com o mesmo nome (se existir)
    PERFORM cron.unschedule(j.jobid)
    FROM cron.job j
    WHERE j.jobname = 'purge_ai_suggestions_daily';

    -- 05:00 UTC todos os dias = 02:00 BRT
    PERFORM cron.schedule(
      'purge_ai_suggestions_daily',
      '0 5 * * *',
      'SELECT public.purge_ai_suggestions();'
    );
  END IF;
END $$;

