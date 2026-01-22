-- Migration: corrigir agendamento do purge (pg_cron) de forma compatível
-- Data: 2026-01-21
-- Objetivo:
-- - garantir que o job "purge_ai_suggestions_daily" exista e rode diariamente
-- - suportar pg_cron instalado no schema padrão (cron) ou no schema extensions
--
-- Observação de fuso:
-- - Supabase normalmente usa timezone UTC no banco
-- - 02:00 BRT (America/Sao_Paulo, UTC-3) = 05:00 UTC
-- - cron: 0 5 * * * (05:00 UTC)

-- Garante a função existir (idempotente)
CREATE OR REPLACE FUNCTION public.purge_ai_suggestions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_suggestions;
$$;

-- Tenta habilitar pg_cron (idempotente, com fallback)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions';
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;
  END IF;
END $$;

-- (Re)agenda o job onde quer que o pg_cron esteja instalado
DO $$
DECLARE
  cron_schema TEXT;
  job_table TEXT;
  job_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN;
  END IF;

  -- Descobre onde está a tabela de jobs
  IF to_regclass('cron.job') IS NOT NULL THEN
    cron_schema := 'cron';
    job_table := 'cron.job';
  ELSIF to_regclass('extensions.job') IS NOT NULL THEN
    cron_schema := 'extensions';
    job_table := 'extensions.job';
  ELSE
    -- pg_cron instalado mas não encontramos a tabela (variação de ambiente)
    RETURN;
  END IF;

  -- Busca job existente por nome (se houver)
  EXECUTE format('SELECT j.jobid FROM %s j WHERE j.jobname = %L LIMIT 1', job_table, 'purge_ai_suggestions_daily')
    INTO job_id;

  -- Remove job antigo para evitar duplicação
  IF job_id IS NOT NULL THEN
    EXECUTE format('SELECT %I.unschedule(%s)', cron_schema, job_id);
  END IF;

  -- Cria job diário às 05:00 UTC (02:00 BRT)
  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    cron_schema,
    'purge_ai_suggestions_daily',
    '0 5 * * *',
    'SELECT public.purge_ai_suggestions();'
  );
END $$;

