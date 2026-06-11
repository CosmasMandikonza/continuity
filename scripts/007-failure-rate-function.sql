-- Continuity: failure_rate aggregates CONFIRMED root-cause findings across ALL tenants.
-- SECURITY DEFINER lets it read past RLS, but it returns ONLY aggregate percentages
-- (component-level counts), never any tenant-identifying row data.
CREATE OR REPLACE FUNCTION failure_rate(p_device_id UUID, p_symptom TEXT)
RETURNS TABLE (
  component_id UUID,
  refdes       VARCHAR,
  kind         VARCHAR,
  root_causes  BIGINT,
  total_repairs BIGINT,
  pct          NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT r.id AS repair_id
    FROM repairs r
    WHERE r.device_id = p_device_id
      AND r.status = 'resolved'
      AND (p_symptom IS NULL OR r.symptom = p_symptom)
  ),
  total AS (SELECT count(*) AS n FROM scoped),
  causes AS (
    SELECT f.component_id, count(DISTINCT f.repair_id) AS rc
    FROM findings f
    JOIN scoped s ON s.repair_id = f.repair_id
    WHERE f.status = 'confirmed'
      AND f.kind = 'root_cause'
      AND f.component_id IS NOT NULL
    GROUP BY f.component_id
  )
  SELECT
    c.component_id,
    cm.refdes,
    cm.kind,
    c.rc                                  AS root_causes,
    (SELECT n FROM total)                 AS total_repairs,
    round(100.0 * c.rc / NULLIF((SELECT n FROM total), 0), 1) AS pct
  FROM causes c
  JOIN components cm ON cm.id = c.component_id
  ORDER BY c.rc DESC;
$$;
