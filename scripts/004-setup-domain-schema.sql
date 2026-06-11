-- Continuity: the REAL domain — electrical graph + repair workflow, multi-tenant.
-- The provenance card the UI shows is DERIVED from joins over components/nets/pins,
-- never stored as rendered cards.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector

-- ---------------------------------------------------------------------------
-- TENANTS & USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       VARCHAR(160) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  role        VARCHAR(10) NOT NULL CHECK (role IN ('owner','tech')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ---------------------------------------------------------------------------
-- ELECTRICAL GRAPH (per device)
-- ---------------------------------------------------------------------------
-- Shared (is_shared=true) reference designs are visible to all tenants.
-- Tenant-private devices carry a tenant_id and are gated by RLS.
CREATE TABLE IF NOT EXISTS devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(120) NOT NULL,
  revision      VARCHAR(40),
  manufacturer  VARCHAR(120),
  is_shared     BOOLEAN NOT NULL DEFAULT false,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (is_shared OR tenant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_shared ON devices(is_shared) WHERE is_shared;

CREATE TABLE IF NOT EXISTS components (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  refdes      VARCHAR(20) NOT NULL,
  kind        VARCHAR(40) NOT NULL,
  value       VARCHAR(80),
  package     VARCHAR(40),
  mpn         VARCHAR(80),
  source_ref  VARCHAR(120),
  confidence  NUMERIC(4,3),
  embedding   vector(1024),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, refdes)
);
CREATE INDEX IF NOT EXISTS idx_components_device ON components(device_id);
CREATE INDEX IF NOT EXISTS idx_components_device_refdes ON components(device_id, refdes);
CREATE INDEX IF NOT EXISTS idx_components_embedding ON components
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS nets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name        VARCHAR(60) NOT NULL,
  net_class   VARCHAR(40),
  nominal_v   NUMERIC(6,3),
  UNIQUE (device_id, name)
);
CREATE INDEX IF NOT EXISTS idx_nets_device ON nets(device_id);

CREATE TABLE IF NOT EXISTS pins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id  UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  number        VARCHAR(8) NOT NULL,
  name          VARCHAR(40),
  role          VARCHAR(40),
  net_id        UUID REFERENCES nets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_pins_component ON pins(component_id);
CREATE INDEX IF NOT EXISTS idx_pins_net ON pins(net_id);

CREATE TABLE IF NOT EXISTS edges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id         UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  src_component_id  UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  dst_component_id  UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  kind              VARCHAR(12) NOT NULL CHECK (kind IN ('powers','enables','resets','clocks','connects')),
  via_net_id        UUID REFERENCES nets(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_edges_device ON edges(device_id);
CREATE INDEX IF NOT EXISTS idx_edges_src ON edges(src_component_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst_component_id);

CREATE TABLE IF NOT EXISTS boot_phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  seq         INT NOT NULL,
  name        VARCHAR(80) NOT NULL,
  rail_net_id UUID REFERENCES nets(id) ON DELETE SET NULL,
  UNIQUE (device_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_boot_phases_device ON boot_phases(device_id);

-- ---------------------------------------------------------------------------
-- REPAIR DOMAIN (stateful, tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repairs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ref         VARCHAR(40) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  symptom     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repairs_tenant ON repairs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_repairs_device ON repairs(device_id);

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id   UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  role        VARCHAR(8) NOT NULL CHECK (role IN ('tech','agent')),
  content     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_repair ON messages(repair_id);

CREATE TABLE IF NOT EXISTS measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id     UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  net_id        UUID REFERENCES nets(id) ON DELETE SET NULL,
  component_id  UUID REFERENCES components(id) ON DELETE SET NULL,
  kind          VARCHAR(40) NOT NULL,
  value         NUMERIC(12,4),
  unit          VARCHAR(16),
  expected      NUMERIC(12,4),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_measurements_repair ON measurements(repair_id);

CREATE TABLE IF NOT EXISTS findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id     UUID NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
  component_id  UUID REFERENCES components(id) ON DELETE SET NULL,
  net_id        UUID REFERENCES nets(id) ON DELETE SET NULL,
  kind          VARCHAR(40) NOT NULL,
  confidence    NUMERIC(4,3),
  status        VARCHAR(10) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed')),
  embedding     vector(1024),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_repair ON findings(repair_id);
CREATE INDEX IF NOT EXISTS idx_findings_component ON findings(component_id);
CREATE INDEX IF NOT EXISTS idx_findings_embedding ON findings
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS citations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  ref_type    VARCHAR(10) NOT NULL CHECK (ref_type IN ('component','net')),
  ref_id      UUID NOT NULL,
  source      VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS idx_citations_message ON citations(message_id);
