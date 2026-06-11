-- Continuity: fleet_shops returns the DISTINCT shop (tenant) count behind a
-- symptom's resolved repairs. SECURITY DEFINER so it reads past RLS, returning
-- only an aggregate count -- never tenant-identifying rows.
CREATE OR REPLACE FUNCTION fleet_shops(p_device_id UUID, p_symptom TEXT)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT r.tenant_id)::int
  FROM repairs r
  WHERE r.device_id = p_device_id
    AND r.status = 'resolved'
    AND (p_symptom IS NULL OR r.symptom = p_symptom);
$$;
