-- Continuity: map Clerk identities onto tenants + users for real multi-tenant auth.
-- Each signed-in Clerk user owns one tenant (their shop). Idempotent + additive:
-- the seeded dev/global rows (migration 006/010) keep clerk_user_id = NULL and stay
-- usable as the no-auth DEV fallback.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE users   ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- One tenant / one user per Clerk identity. Partial unique indexes so the many
-- existing NULL rows (dev + synthetic fleet tenants) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_clerk_user_id_key
  ON tenants (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_clerk_user_id_key
  ON users (clerk_user_id) WHERE clerk_user_id IS NOT NULL;
