-- 015: shop-scoped semantic case memory --------------------------------------
-- similar_findings (013) ranks confirmed cases across ALL shops. This adds a
-- TENANT-SCOPED variant so each shop's pgvector recall is over ITS OWN confirmed
-- cases only: a shop's verified repairs become its private, compounding knowledge
-- base, isolated from every other shop exactly like its repair history. Still
-- SECURITY DEFINER (reads past RLS) but filtered to p_tenant, returning only that
-- shop's anonymized case facts.

CREATE OR REPLACE FUNCTION shop_similar_findings(
  p_embedding vector,
  p_device    UUID,
  p_tenant    UUID,
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
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device AND r.tenant_id = p_tenant
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NOT NULL
    AND f.status = 'confirmed'
  ORDER BY f.embedding <=> p_embedding
  LIMIT GREATEST(p_k, 1);
$$;

GRANT EXECUTE ON FUNCTION shop_similar_findings(vector, UUID, UUID, INT) TO PUBLIC;
