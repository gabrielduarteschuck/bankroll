-- Migration: Métricas detalhadas de usuários
-- Data: 2026-01-30
-- Objetivo:
-- - Criar função analytics_users_detailed com ordenação por atividade
-- - Adicionar métricas: usuários 5+ entradas, ativos diários, retenção

-- ============================================================================
-- 1. FUNÇÃO analytics_users_detailed - Lista usuários ordenados por atividade
-- ============================================================================

CREATE OR REPLACE FUNCTION public.analytics_users_detailed()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  is_paid BOOLEAN,
  onboarding_completed BOOLEAN,
  total_sessions BIGINT,
  total_page_views BIGINT,
  days_active BIGINT,
  total_entradas BIGINT,
  entradas_green BIGINT,
  entradas_red BIGINT,
  entradas_pendente BIGINT,
  taxa_green NUMERIC,
  has_banca BOOLEAN,
  total_time_seconds BIGINT,
  activity_score NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_analytics AS (
    SELECT
      ae.user_id,
      COUNT(DISTINCT ae.session_id) as total_sessions,
      COUNT(*) FILTER (WHERE ae.event_type = 'page_view') as total_page_views,
      COUNT(DISTINCT DATE(ae.created_at)) as days_active,
      COALESCE(SUM(ae.time_on_page_seconds) FILTER (WHERE ae.time_on_page_seconds IS NOT NULL AND ae.time_on_page_seconds < 3600), 0) as total_time_seconds,
      MAX(ae.created_at) as last_activity
    FROM public.analytics_events ae
    WHERE ae.user_id IS NOT NULL
    GROUP BY ae.user_id
  ),
  user_entradas AS (
    SELECT
      e.user_id,
      COUNT(*) as total_entradas,
      COUNT(*) FILTER (WHERE e.resultado = 'green') as entradas_green,
      COUNT(*) FILTER (WHERE e.resultado = 'red') as entradas_red,
      COUNT(*) FILTER (WHERE e.resultado = 'pendente' OR e.resultado IS NULL) as entradas_pendente
    FROM public.entradas e
    GROUP BY e.user_id
  ),
  user_multiplas AS (
    SELECT
      m.user_id,
      COUNT(*) as total_multiplas,
      COUNT(*) FILTER (WHERE m.resultado = 'green') as multiplas_green,
      COUNT(*) FILTER (WHERE m.resultado = 'red') as multiplas_red
    FROM public.apostas_multiplas m
    GROUP BY m.user_id
  ),
  user_banca AS (
    SELECT DISTINCT user_id, TRUE as has_banca
    FROM public.banca
  )
  SELECT
    p.id as user_id,
    p.email::TEXT,
    p.created_at,
    ua.last_activity,
    COALESCE(sp.is_paid, FALSE) as is_paid,
    COALESCE(p.onboarding_completed, FALSE) as onboarding_completed,
    COALESCE(ua.total_sessions, 0)::BIGINT as total_sessions,
    COALESCE(ua.total_page_views, 0)::BIGINT as total_page_views,
    COALESCE(ua.days_active, 0)::BIGINT as days_active,
    (COALESCE(ue.total_entradas, 0) + COALESCE(um.total_multiplas, 0))::BIGINT as total_entradas,
    (COALESCE(ue.entradas_green, 0) + COALESCE(um.multiplas_green, 0))::BIGINT as entradas_green,
    (COALESCE(ue.entradas_red, 0) + COALESCE(um.multiplas_red, 0))::BIGINT as entradas_red,
    COALESCE(ue.entradas_pendente, 0)::BIGINT as entradas_pendente,
    CASE
      WHEN (COALESCE(ue.entradas_green, 0) + COALESCE(um.multiplas_green, 0) + COALESCE(ue.entradas_red, 0) + COALESCE(um.multiplas_red, 0)) > 0
      THEN ROUND(
        (COALESCE(ue.entradas_green, 0) + COALESCE(um.multiplas_green, 0))::NUMERIC /
        (COALESCE(ue.entradas_green, 0) + COALESCE(um.multiplas_green, 0) + COALESCE(ue.entradas_red, 0) + COALESCE(um.multiplas_red, 0)) * 100,
        1
      )
      ELSE 0
    END as taxa_green,
    COALESCE(ub.has_banca, FALSE) as has_banca,
    COALESCE(ua.total_time_seconds, 0)::BIGINT as total_time_seconds,
    -- Activity Score: combina entradas, sessões, page views e tempo
    (
      COALESCE(ue.total_entradas, 0) * 10 +
      COALESCE(um.total_multiplas, 0) * 10 +
      COALESCE(ua.total_sessions, 0) * 2 +
      COALESCE(ua.total_page_views, 0) * 0.5 +
      COALESCE(ua.days_active, 0) * 5 +
      COALESCE(ua.total_time_seconds, 0) / 60.0
    )::NUMERIC as activity_score
  FROM public.profiles p
  LEFT JOIN public.stripe_payments sp ON LOWER(sp.email) = LOWER(p.email)
  LEFT JOIN user_analytics ua ON ua.user_id = p.id
  LEFT JOIN user_entradas ue ON ue.user_id = p.id
  LEFT JOIN user_multiplas um ON um.user_id = p.id
  LEFT JOIN user_banca ub ON ub.user_id = p.id
  ORDER BY activity_score DESC NULLS LAST, p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_users_detailed() TO authenticated;

-- ============================================================================
-- 2. ATUALIZAR analytics_summary com novas métricas
-- ============================================================================

DROP FUNCTION IF EXISTS public.analytics_summary();

CREATE OR REPLACE FUNCTION public.analytics_summary()
RETURNS TABLE(
  total_users BIGINT,
  users_paid BIGINT,
  users_onboarding_completed BIGINT,
  users_with_banca BIGINT,
  users_with_entrada BIGINT,
  users_with_5plus_entradas BIGINT,
  users_daily_active BIGINT,
  first_entrada_rate NUMERIC,
  total_page_views BIGINT,
  total_sessions BIGINT,
  avg_pages_per_session NUMERIC,
  users_active_today BIGINT,
  users_active_week BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_entrada_counts AS (
    SELECT user_id, COUNT(*) as cnt
    FROM (
      SELECT user_id FROM public.entradas
      UNION ALL
      SELECT user_id FROM public.apostas_multiplas
    ) combined
    GROUP BY user_id
  ),
  daily_active_users AS (
    -- Usuários que voltaram em menos de 24h (pelo menos 2 sessões em dias consecutivos)
    SELECT COUNT(DISTINCT user_id) as cnt
    FROM (
      SELECT
        user_id,
        DATE(created_at) as activity_date,
        LAG(DATE(created_at)) OVER (PARTITION BY user_id ORDER BY DATE(created_at)) as prev_date
      FROM public.analytics_events
      WHERE user_id IS NOT NULL AND event_type = 'session_start'
      GROUP BY user_id, DATE(created_at)
    ) sub
    WHERE activity_date - prev_date = 1
  )
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::BIGINT as total_users,
    (SELECT COUNT(DISTINCT LOWER(email)) FROM public.stripe_payments WHERE is_paid = TRUE)::BIGINT as users_paid,
    (SELECT COUNT(*) FROM public.profiles WHERE onboarding_completed = TRUE)::BIGINT as users_onboarding_completed,
    (SELECT COUNT(DISTINCT user_id) FROM public.banca)::BIGINT as users_with_banca,
    (SELECT COUNT(DISTINCT user_id) FROM user_entrada_counts WHERE cnt >= 1)::BIGINT as users_with_entrada,
    (SELECT COUNT(DISTINCT user_id) FROM user_entrada_counts WHERE cnt >= 5)::BIGINT as users_with_5plus_entradas,
    (SELECT cnt FROM daily_active_users)::BIGINT as users_daily_active,
    CASE
      WHEN (SELECT COUNT(*) FROM public.profiles) > 0
      THEN ROUND(
        (SELECT COUNT(DISTINCT user_id) FROM user_entrada_counts WHERE cnt >= 1)::NUMERIC /
        (SELECT COUNT(*) FROM public.profiles) * 100,
        1
      )
      ELSE 0
    END as first_entrada_rate,
    (SELECT COUNT(*) FROM public.analytics_events WHERE event_type = 'page_view')::BIGINT as total_page_views,
    (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events WHERE session_id IS NOT NULL)::BIGINT as total_sessions,
    COALESCE(
      (SELECT ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT session_id), 0), 1)
       FROM public.analytics_events
       WHERE event_type = 'page_view' AND session_id IS NOT NULL),
      0
    ) as avg_pages_per_session,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE user_id IS NOT NULL AND created_at >= CURRENT_DATE)::BIGINT as users_active_today,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE user_id IS NOT NULL AND created_at >= CURRENT_DATE - INTERVAL '7 days')::BIGINT as users_active_week;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_summary() TO authenticated;

-- ============================================================================
-- 3. FUNÇÃO de retenção melhorada (D1, D7, D30)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.analytics_retention_detailed()
RETURNS TABLE(
  period TEXT,
  total_users BIGINT,
  returned_users BIGINT,
  retention_rate NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_visit AS (
    SELECT
      user_id,
      DATE(MIN(created_at)) as first_day
    FROM public.analytics_events
    WHERE user_id IS NOT NULL
    GROUP BY user_id
  ),
  returned_d1 AS (
    SELECT DISTINCT fv.user_id
    FROM first_visit fv
    INNER JOIN public.analytics_events e ON e.user_id = fv.user_id
    WHERE DATE(e.created_at) = fv.first_day + INTERVAL '1 day'
  ),
  returned_d7 AS (
    SELECT DISTINCT fv.user_id
    FROM first_visit fv
    INNER JOIN public.analytics_events e ON e.user_id = fv.user_id
    WHERE DATE(e.created_at) BETWEEN fv.first_day + INTERVAL '1 day' AND fv.first_day + INTERVAL '7 days'
  ),
  returned_d30 AS (
    SELECT DISTINCT fv.user_id
    FROM first_visit fv
    INNER JOIN public.analytics_events e ON e.user_id = fv.user_id
    WHERE DATE(e.created_at) BETWEEN fv.first_day + INTERVAL '1 day' AND fv.first_day + INTERVAL '30 days'
  )
  SELECT 'D1' as period,
    (SELECT COUNT(*) FROM first_visit)::BIGINT as total_users,
    (SELECT COUNT(*) FROM returned_d1)::BIGINT as returned_users,
    CASE WHEN (SELECT COUNT(*) FROM first_visit) > 0
      THEN ROUND((SELECT COUNT(*) FROM returned_d1)::NUMERIC / (SELECT COUNT(*) FROM first_visit) * 100, 1)
      ELSE 0
    END as retention_rate
  UNION ALL
  SELECT 'D7' as period,
    (SELECT COUNT(*) FROM first_visit)::BIGINT,
    (SELECT COUNT(*) FROM returned_d7)::BIGINT,
    CASE WHEN (SELECT COUNT(*) FROM first_visit) > 0
      THEN ROUND((SELECT COUNT(*) FROM returned_d7)::NUMERIC / (SELECT COUNT(*) FROM first_visit) * 100, 1)
      ELSE 0
    END
  UNION ALL
  SELECT 'D30' as period,
    (SELECT COUNT(*) FROM first_visit)::BIGINT,
    (SELECT COUNT(*) FROM returned_d30)::BIGINT,
    CASE WHEN (SELECT COUNT(*) FROM first_visit) > 0
      THEN ROUND((SELECT COUNT(*) FROM returned_d30)::NUMERIC / (SELECT COUNT(*) FROM first_visit) * 100, 1)
      ELSE 0
    END;
$$;

GRANT EXECUTE ON FUNCTION public.analytics_retention_detailed() TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION public.analytics_users_detailed IS 'Lista todos usuários ordenados por activity_score (mais ativos primeiro)';
COMMENT ON FUNCTION public.analytics_summary IS 'Resumo geral com métricas de funil, engajamento e retenção';
COMMENT ON FUNCTION public.analytics_retention_detailed IS 'Métricas de retenção D1, D7 e D30';
