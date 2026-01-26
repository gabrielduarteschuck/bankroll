-- Migration: Add confianca_percent to multiplas and create voting system
-- Similar to ai_suggestions voting system

-- 1. Add confianca_percent column to multiplas
ALTER TABLE multiplas ADD COLUMN IF NOT EXISTS confianca_percent int DEFAULT 50;

-- 2. Add status column (ABERTO/FECHADO)
ALTER TABLE multiplas ADD COLUMN IF NOT EXISTS status text DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO'));

-- 3. Create votes table for multiplas
CREATE TABLE IF NOT EXISTS multiplas_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multipla_id uuid NOT NULL REFERENCES multiplas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (1, -1)),
  created_at timestamptz DEFAULT now(),
  UNIQUE(multipla_id, user_id)
);

-- Enable RLS
ALTER TABLE multiplas_votes ENABLE ROW LEVEL SECURITY;

-- Policies for multiplas_votes
DROP POLICY IF EXISTS "Users can view votes on multiplas" ON multiplas_votes;
CREATE POLICY "Users can view votes on multiplas" ON multiplas_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own vote" ON multiplas_votes;
CREATE POLICY "Users can insert own vote" ON multiplas_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vote" ON multiplas_votes;
CREATE POLICY "Users can update own vote" ON multiplas_votes
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vote" ON multiplas_votes;
CREATE POLICY "Users can delete own vote" ON multiplas_votes
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Create aggregate function for multiplas votes
CREATE OR REPLACE FUNCTION multiplas_votes_aggregate(multipla_ids uuid[])
RETURNS TABLE (
  multipla_id uuid,
  likes bigint,
  dislikes bigint,
  my_vote smallint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS multipla_id,
    COALESCE(SUM(CASE WHEN v.vote = 1 THEN 1 ELSE 0 END), 0)::bigint AS likes,
    COALESCE(SUM(CASE WHEN v.vote = -1 THEN 1 ELSE 0 END), 0)::bigint AS dislikes,
    (
      SELECT mv.vote FROM multiplas_votes mv
      WHERE mv.multipla_id = m.id AND mv.user_id = auth.uid()
    ) AS my_vote
  FROM unnest(multipla_ids) AS m(id)
  LEFT JOIN multiplas_votes v ON v.multipla_id = m.id
  GROUP BY m.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION multiplas_votes_aggregate(uuid[]) TO authenticated;
