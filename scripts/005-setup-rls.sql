-- Continuity: Row-Level Security.
-- Tenant scoping uses the session GUC app.current_tenant (set per-request by the app).
-- Shared reference devices (is_shared=true) are visible to every tenant.

-- Helper: current tenant from session setting (NULL-safe).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- DEVICES: shared rows visible to all; private rows only to their tenant.
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devices_select ON devices;
CREATE POLICY devices_select ON devices FOR SELECT
  USING (is_shared OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS devices_write ON devices;
CREATE POLICY devices_write ON devices FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- USERS: scoped to tenant.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_tenant ON users;
CREATE POLICY users_tenant ON users FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- REPAIRS: scoped to tenant.
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS repairs_tenant ON repairs;
CREATE POLICY repairs_tenant ON repairs FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- MESSAGES / MEASUREMENTS / FINDINGS: scoped via their parent repair's tenant.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_tenant ON messages;
CREATE POLICY messages_tenant ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM repairs r WHERE r.id = messages.repair_id
                 AND r.tenant_id = current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM repairs r WHERE r.id = messages.repair_id
                 AND r.tenant_id = current_tenant_id()));

ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS measurements_tenant ON measurements;
CREATE POLICY measurements_tenant ON measurements FOR ALL
  USING (EXISTS (SELECT 1 FROM repairs r WHERE r.id = measurements.repair_id
                 AND r.tenant_id = current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM repairs r WHERE r.id = measurements.repair_id
                 AND r.tenant_id = current_tenant_id()));

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS findings_tenant ON findings;
CREATE POLICY findings_tenant ON findings FOR ALL
  USING (EXISTS (SELECT 1 FROM repairs r WHERE r.id = findings.repair_id
                 AND r.tenant_id = current_tenant_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM repairs r WHERE r.id = findings.repair_id
                 AND r.tenant_id = current_tenant_id()));

-- NOTE: failureRate() aggregates CONFIRMED findings across ALL tenants. It must run
-- as a SECURITY DEFINER function (defined in the query layer) so it can read past RLS,
-- returning only aggregate percentages — never row-level cross-tenant data.
