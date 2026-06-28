-- Continuity: map Clerk Organizations onto tenants for real B2B multi-tenant auth.
-- A Clerk Organization is a SHOP; all its members (technicians) share ONE tenant,
-- and therefore one repair history and one verified knowledge base, isolated from
-- every other shop. Idempotent + additive: the per-user tenants (clerk_user_id,
-- migration 012) and the seeded dev/fleet rows are untouched and keep working.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;

-- One tenant per Clerk Organization. Partial unique index so the many existing
-- rows with clerk_org_id = NULL (per-user shops, dev, synthetic fleet) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_clerk_org_id_key
  ON tenants (clerk_org_id) WHERE clerk_org_id IS NOT NULL;
