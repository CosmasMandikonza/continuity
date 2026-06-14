-- 013: pgvector semantic case retrieval ------------------------------------
-- Activates the dormant findings.embedding column + HNSW cosine index (004)
-- as cross-fleet SEMANTIC case search. Where failure_rate() matches a symptom
-- by EXACT string, this matches by MEANING: a technician can describe a fault
-- in their own words and still surface the relevant confirmed history.
--
-- All three functions are SECURITY DEFINER (same model as failure_rate /
-- fleet_shops): they read confirmed findings across every shop, past RLS, but
-- return ONLY anonymized case facts — never tenant- or repair-identifying data.

-- Runtime query: confirmed findings ranked by cosine distance to a query vector,
-- using the HNSW (vector_cosine_ops) index from migration 004.
CREATE OR REPLACE FUNCTION similar_findings(
  p_embedding vector,
  p_device    UUID,
  p_k         INT DEFAULT 8
)
RETURNS TABLE (
  refdes     VARCHAR,
  net        VARCHAR,
  kind       VARCHAR,
  confidence NUMERIC,
  symptom    TEXT,
  similarity NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.refdes,
    n.name,
    f.kind,
    f.confidence,
    r.symptom,
    round((1 - (f.embedding <=> p_embedding))::numeric, 4) AS similarity
  FROM findings f
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NOT NULL
    AND f.status = 'confirmed'
  ORDER BY f.embedding <=> p_embedding
  LIMIT GREATEST(p_k, 1);
$$;

-- Backfill read: confirmed findings still missing an embedding, paired with the
-- case text to embed (symptom + the confirmed culprit).
CREATE OR REPLACE FUNCTION findings_needing_embedding(p_device UUID)
RETURNS TABLE (finding_id UUID, doc TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    'Symptom: ' || coalesce(r.symptom, 'unknown')
      || '. Confirmed root cause on this board: ' || coalesce(c.refdes, 'unknown')
      || coalesce(', rail ' || n.name, '') AS doc
  FROM findings f
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NULL
    AND f.status = 'confirmed';
$$;

-- Backfill write: store a generated embedding on a finding.
CREATE OR REPLACE FUNCTION set_finding_embedding(p_id UUID, p_embedding vector)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE findings SET embedding = p_embedding WHERE id = p_id;
$$;

GRANT EXECUTE ON FUNCTION similar_findings(vector, UUID, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION findings_needing_embedding(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_finding_embedding(UUID, vector) TO PUBLIC;
