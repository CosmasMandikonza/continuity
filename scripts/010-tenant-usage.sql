-- Continuity: per-tenant monthly metering. Backs the "142/500 DIAGNOSTICS" pill.
-- A row per (tenant, YYYY-MM) period; RLS-scoped so a tenant only sees its own usage.

CREATE TABLE IF NOT EXISTS tenant_usage (
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period     TEXT NOT NULL,                 -- YYYY-MM
  used       INT  NOT NULL DEFAULT 0,
  quota      INT  NOT NULL DEFAULT 500,
  PRIMARY KEY (tenant_id, period)
);

ALTER TABLE tenant_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_usage_tenant ON tenant_usage;
CREATE POLICY tenant_usage_tenant ON tenant_usage FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- A dev tenant the live agent writes against until real auth lands.
INSERT INTO tenants (id, name)
VALUES ('a0000000-0000-0000-0000-0000000000d0', 'Continuity Dev Bench')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, name, role)
VALUES ('b0000000-0000-0000-0000-0000000000d0',
        'a0000000-0000-0000-0000-0000000000d0',
        'bench@continuity.test', 'Bench Tech', 'owner')
ON CONFLICT (email) DO NOTHING;
