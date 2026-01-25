-- Migration: Sistema de Analytics de Usuários
-- Data: 2026-01-25
-- Objetivo:
-- - Criar tabela para eventos de analytics
-- - Rastrear comportamento dos usuários
-- - Métricas: page views, cliques, criação de banca, registros, retenção

-- ============================================================================
-- 1. TABELA PRINCIPAL DE EVENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identificação do usuário
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Tipo de evento
  event_type TEXT NOT NULL,
  -- Tipos esperados:
  -- page_view, click, form_submit, banca_created, entrada_registered,
  -- suggestion_clicked, suggestion_voted, session_start, session_end

  -- Dados do evento
  page_path TEXT,
  element_id TEXT,
  element_text TEXT,

  -- Metadados adicionais (JSON flexível)
  metadata JSONB DEFAULT '{}',

  -- Dados de sessão
  session_id TEXT,

  -- Dados de tempo
  time_on_page_seconds INTEGER,

  -- Índices para performance
  CONSTRAINT analytics_events_type_check CHECK (event_type IS NOT NULL AND event_type != '')
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON public.analytics_events(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);

-- ============================================================================
-- 2. RLS - USUÁRIOS PODEM INSERIR, ADMIN PODE LER
-- ============================================================================

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem inserir eventos (seus próprios)
CREATE POLICY "analytics_events_insert" ON public.analytics_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Apenas admin pode SELECT
CREATE POLICY "analytics_events_admin_select" ON public.analytics_events
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============================================================================
-- 3. FUNÇÃO RPC PARA REGISTRAR EVENTOS (performance otimizada)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.track_event(
  p_event_type TEXT,
  p_page_path TEXT DEFAULT NULL,
  p_element_id TEXT DEFAULT NULL,
  p_element_text TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_session_id TEXT DEFAULT NULL,
  p_time_on_page INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
BEGIN
  -- Pega user_id do JWT (pode ser NULL para não autenticados)
  v_user_id := auth.uid();

  -- Insere o evento
  INSERT INTO public.analytics_events (
    user_id,
    event_type,
    page_path,
    element_id,
    element_text,
    metadata,
    session_id,
    time_on_page_seconds
  )
  VALUES (
    v_user_id,
    p_event_type,
    p_page_path,
    p_element_id,
    p_element_text,
    p_metadata,
    p_session_id,
    p_time_on_page
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_event(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_event(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INTEGER) TO anon;

-- ============================================================================
-- 4. FUNÇÕES DE RELATÓRIO PARA ADMIN
-- ============================================================================

-- Total de usuários que criaram banca
CREATE OR REPLACE FUNCTION public.analytics_users_with_banca()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)
  FROM public.analytics_events
  WHERE event_type = 'banca_created';
$$;

-- Total de usuários que registraram entrada
CREATE OR REPLACE FUNCTION public.analytics_users_with_entrada()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)
  FROM public.analytics_events
  WHERE event_type = 'entrada_registered';
$$;

-- Usuários que voltaram no dia seguinte (retenção D1)
CREATE OR REPLACE FUNCTION public.analytics_retention_d1()
RETURNS TABLE(total_users BIGINT, returned_users BIGINT, retention_rate NUMERIC)
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
  returned AS (
    SELECT DISTINCT fv.user_id
    FROM first_visit fv
    INNER JOIN public.analytics_events e ON e.user_id = fv.user_id
    WHERE DATE(e.created_at) = fv.first_day + INTERVAL '1 day'
  )
  SELECT
    (SELECT COUNT(*) FROM first_visit)::BIGINT as total_users,
    (SELECT COUNT(*) FROM returned)::BIGINT as returned_users,
    CASE
      WHEN (SELECT COUNT(*) FROM first_visit) > 0
      THEN ROUND((SELECT COUNT(*) FROM returned)::NUMERIC / (SELECT COUNT(*) FROM first_visit) * 100, 2)
      ELSE 0
    END as retention_rate;
$$;

-- Page views por página (top 10)
CREATE OR REPLACE FUNCTION public.analytics_top_pages()
RETURNS TABLE(page_path TEXT, view_count BIGINT, unique_users BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    page_path,
    COUNT(*) as view_count,
    COUNT(DISTINCT user_id) as unique_users
  FROM public.analytics_events
  WHERE event_type = 'page_view' AND page_path IS NOT NULL
  GROUP BY page_path
  ORDER BY view_count DESC
  LIMIT 10;
$$;

-- Drop-off: última página visitada antes de sair
CREATE OR REPLACE FUNCTION public.analytics_dropoff_pages()
RETURNS TABLE(page_path TEXT, dropoff_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH last_pages AS (
    SELECT
      user_id,
      session_id,
      page_path,
      ROW_NUMBER() OVER (PARTITION BY user_id, session_id ORDER BY created_at DESC) as rn
    FROM public.analytics_events
    WHERE event_type = 'page_view' AND page_path IS NOT NULL AND session_id IS NOT NULL
  )
  SELECT
    page_path,
    COUNT(*) as dropoff_count
  FROM last_pages
  WHERE rn = 1
  GROUP BY page_path
  ORDER BY dropoff_count DESC
  LIMIT 10;
$$;

-- Tempo médio por página
CREATE OR REPLACE FUNCTION public.analytics_avg_time_per_page()
RETURNS TABLE(page_path TEXT, avg_seconds NUMERIC, total_views BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    page_path,
    ROUND(AVG(time_on_page_seconds)::NUMERIC, 1) as avg_seconds,
    COUNT(*) as total_views
  FROM public.analytics_events
  WHERE event_type = 'page_view'
    AND page_path IS NOT NULL
    AND time_on_page_seconds IS NOT NULL
    AND time_on_page_seconds > 0
    AND time_on_page_seconds < 3600 -- ignora outliers > 1h
  GROUP BY page_path
  ORDER BY avg_seconds DESC
  LIMIT 10;
$$;

-- Cliques em sugestões da IA (detalhado)
CREATE OR REPLACE FUNCTION public.analytics_suggestion_clicks()
RETURNS TABLE(suggestion_id UUID, click_count BIGINT, unique_users BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (metadata->>'suggestion_id')::UUID as suggestion_id,
    COUNT(*) as click_count,
    COUNT(DISTINCT user_id) as unique_users
  FROM public.analytics_events
  WHERE event_type = 'suggestion_clicked'
    AND metadata->>'suggestion_id' IS NOT NULL
  GROUP BY metadata->>'suggestion_id'
  ORDER BY click_count DESC
  LIMIT 20;
$$;

-- Resumo geral de métricas
CREATE OR REPLACE FUNCTION public.analytics_summary()
RETURNS TABLE(
  total_users BIGINT,
  users_with_banca BIGINT,
  users_with_entrada BIGINT,
  total_page_views BIGINT,
  total_sessions BIGINT,
  avg_pages_per_session NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE user_id IS NOT NULL) as total_users,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE event_type = 'banca_created') as users_with_banca,
    (SELECT COUNT(DISTINCT user_id) FROM public.analytics_events WHERE event_type = 'entrada_registered') as users_with_entrada,
    (SELECT COUNT(*) FROM public.analytics_events WHERE event_type = 'page_view') as total_page_views,
    (SELECT COUNT(DISTINCT session_id) FROM public.analytics_events WHERE session_id IS NOT NULL) as total_sessions,
    COALESCE(
      (SELECT ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT session_id), 0), 1)
       FROM public.analytics_events
       WHERE event_type = 'page_view' AND session_id IS NOT NULL),
      0
    ) as avg_pages_per_session;
$$;

-- Conceder permissões para admin
GRANT EXECUTE ON FUNCTION public.analytics_users_with_banca() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_users_with_entrada() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_retention_d1() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_top_pages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_dropoff_pages() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_avg_time_per_page() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_suggestion_clicks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_summary() TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON TABLE public.analytics_events IS 'Eventos de analytics para rastrear comportamento dos usuários';
COMMENT ON FUNCTION public.track_event IS 'RPC para registrar eventos de analytics';
COMMENT ON FUNCTION public.analytics_summary IS 'Resumo geral das métricas de analytics';
