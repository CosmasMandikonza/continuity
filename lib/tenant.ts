import { cache } from 'react'
import { query, withTenant } from './db'
import { isClerkEnabled } from './clerk-config'

// Seeded dev tenant/user (migration 010). Used as the no-auth fallback so the
// scripted demo runs with zero Clerk keys.
export const DEV_TENANT_ID = 'a0000000-0000-0000-0000-0000000000d0'
export const DEV_USER_ID = 'b0000000-0000-0000-0000-0000000000d0'

export interface TenantContext {
  tenantId: string
  userId: string
}

// getTenantContext() -> the internal tenant + user uuid for the current request.
//
// B2B model: a Clerk ORGANIZATION is a shop. Every member (technician) of the org
// shares ONE tenant -> one repair history -> one verified knowledge base, isolated
// from other shops. We read the ACTIVE org from the Clerk session and map it to a
// tenants row keyed by clerk_org_id, provisioning on first access.
//
// Fallbacks so the app never breaks: a signed-in user with no active org gets a
// private personal tenant (clerk_user_id); with no Clerk at all, the seeded DEV
// tenant runs the scripted demo. Cached per request so concurrent reads share one
// lookup.
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  if (!isClerkEnabled()) {
    return { tenantId: DEV_TENANT_ID, userId: DEV_USER_ID }
  }

  const { auth } = await import('@clerk/nextjs/server')
  const { userId: clerkUserId, orgId, orgRole } = await auth()

  // Unauthenticated request slipping past middleware -> safe dev fallback.
  if (!clerkUserId) {
    return { tenantId: DEV_TENANT_ID, userId: DEV_USER_ID }
  }

  // The shop is the active organization, shared by its whole team.
  if (orgId) {
    return resolveOrgTenant(clerkUserId, orgId, orgRole ?? null)
  }

  // Signed in, but no org selected yet -> private personal workspace.
  return resolvePersonalTenant(clerkUserId)
})

// --- ORG (shop) -> tenant; all members share it ----------------------------
async function resolveOrgTenant(
  clerkUserId: string,
  orgId: string,
  orgRole: string | null,
): Promise<TenantContext> {
  // Fast path: the org's tenant and this member's row already exist.
  const existing = await query<{ tenant_id: string; user_id: string | null }>(
    `SELECT t.id AS tenant_id,
            (SELECT u.id FROM users u
              WHERE u.clerk_user_id = $2 AND u.tenant_id = t.id LIMIT 1) AS user_id
     FROM tenants t
     WHERE t.clerk_org_id = $1
     LIMIT 1`,
    [orgId, clerkUserId],
  )
  if (existing.rows.length && existing.rows[0].user_id) {
    return { tenantId: existing.rows[0].tenant_id, userId: existing.rows[0].user_id }
  }

  // Provision the shop tenant (idempotent), named from the Clerk org if available.
  const shopName = await orgDisplayName(orgId)
  const tenantRes = await query<{ id: string }>(
    `INSERT INTO tenants (name, clerk_org_id)
     VALUES ($1, $2)
     ON CONFLICT (clerk_org_id) WHERE clerk_org_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [shopName, orgId],
  )
  const tenantId = tenantRes.rows[0].id

  // Map Clerk org role -> our two-role model (org admins are shop owners).
  const role = orgRole === 'org:admin' ? 'owner' : 'tech'
  const { email, name } = await profileFields(clerkUserId)

  // users is RLS-scoped -> insert inside withTenant so the WITH CHECK passes.
  const userId = await withTenant(tenantId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, name, role, clerk_user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL
         DO UPDATE SET tenant_id = EXCLUDED.tenant_id,
                       email     = EXCLUDED.email,
                       name      = EXCLUDED.name,
                       role      = EXCLUDED.role
       RETURNING id`,
      [tenantId, email, name, role, clerkUserId],
    )
    return res.rows[0].id as string
  })

  return { tenantId, userId }
}

// --- personal fallback (signed in, no active org) --------------------------
async function resolvePersonalTenant(clerkUserId: string): Promise<TenantContext> {
  const existing = await query<{ tenant_id: string; user_id: string }>(
    `SELECT t.id AS tenant_id, u.id AS user_id
     FROM tenants t
     JOIN users u ON u.clerk_user_id = t.clerk_user_id
     WHERE t.clerk_user_id = $1
     LIMIT 1`,
    [clerkUserId],
  )
  if (existing.rows.length) {
    return { tenantId: existing.rows[0].tenant_id, userId: existing.rows[0].user_id }
  }

  const { email, name } = await profileFields(clerkUserId)
  const tenantRes = await query<{ id: string }>(
    `INSERT INTO tenants (name, clerk_user_id)
     VALUES ($1, $2)
     ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, clerkUserId],
  )
  const tenantId = tenantRes.rows[0].id

  const userId = await withTenant(tenantId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, name, role, clerk_user_id)
       VALUES ($1, $2, $3, 'owner', $4)
       ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL
         DO UPDATE SET tenant_id = EXCLUDED.tenant_id, email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id`,
      [tenantId, email, name, clerkUserId],
    )
    return res.rows[0].id as string
  })

  return { tenantId, userId }
}

// --- Clerk helpers (imported lazily; never loaded when auth is disabled) ----
async function orgDisplayName(orgId: string): Promise<string> {
  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const org = await client.organizations.getOrganization({ organizationId: orgId })
    return org.name || org.slug || 'Shop'
  } catch {
    return 'Shop'
  }
}

async function profileFields(clerkUserId: string): Promise<{ email: string; name: string }> {
  try {
    const { currentUser } = await import('@clerk/nextjs/server')
    const profile = await currentUser()
    const email =
      profile?.primaryEmailAddress?.emailAddress ??
      profile?.emailAddresses?.[0]?.emailAddress ??
      `${clerkUserId}@clerk.local`
    const name =
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
      profile?.username ||
      (email.includes('@') ? email.split('@')[0] : 'Technician')
    return { email, name }
  } catch {
    return { email: `${clerkUserId}@clerk.local`, name: 'Technician' }
  }
}

// Convenience: just the tenant uuid.
export async function getTenantId(): Promise<string> {
  return (await getTenantContext()).tenantId
}
