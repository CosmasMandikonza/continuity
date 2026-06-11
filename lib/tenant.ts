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

// getTenantId() -> the internal tenant uuid for the current request.
//
// With Clerk configured: read the signed-in Clerk userId, upsert a tenants row
// keyed by clerk_user_id (one shop per user) + a matching users row, and return
// the tenant uuid. Cached per request so concurrent reads share one lookup.
//
// Without Clerk (dev / no keys): return DEV_TENANT_ID so the shared board, the
// fleet insight, and the scripted demo all keep working unchanged.
export const getTenantContext = cache(async (): Promise<TenantContext> => {
  if (!isClerkEnabled()) {
    return { tenantId: DEV_TENANT_ID, userId: DEV_USER_ID }
  }

  // Imported lazily so the Clerk SDK is never loaded when auth is disabled.
  const { auth, currentUser } = await import('@clerk/nextjs/server')
  const { userId: clerkUserId } = await auth()

  // Unauthenticated request slipping past middleware -> safe dev fallback.
  if (!clerkUserId) {
    return { tenantId: DEV_TENANT_ID, userId: DEV_USER_ID }
  }

  // Fast path: tenant already provisioned for this Clerk identity.
  const existing = await query<{ tenant_id: string; user_id: string }>(
    `SELECT t.id AS tenant_id, u.id AS user_id
     FROM tenants t
     JOIN users u ON u.clerk_user_id = t.clerk_user_id
     WHERE t.clerk_user_id = $1
     LIMIT 1`,
    [clerkUserId],
  )
  if (existing.rows.length) {
    return {
      tenantId: existing.rows[0].tenant_id,
      userId: existing.rows[0].user_id,
    }
  }

  // First sign-in: provision a shop. Pull display info from the Clerk profile.
  const profile = await currentUser()
  const email =
    profile?.primaryEmailAddress?.emailAddress ??
    profile?.emailAddresses?.[0]?.emailAddress ??
    `${clerkUserId}@clerk.local`
  const shopName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
    profile?.username ||
    (email.includes('@') ? `${email.split('@')[0]}'s Bench` : 'New Shop')

  // tenants has no RLS -> insert directly. ON CONFLICT guards concurrent first hits.
  const tenantRes = await query<{ id: string }>(
    `INSERT INTO tenants (name, clerk_user_id)
     VALUES ($1, $2)
     ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [shopName, clerkUserId],
  )
  const tenantId = tenantRes.rows[0].id

  // users IS RLS-scoped -> insert inside withTenant so the WITH CHECK passes.
  const userId = await withTenant(tenantId, async (client) => {
    const res = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, name, role, clerk_user_id)
       VALUES ($1, $2, $3, 'owner', $4)
       ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL
         DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id`,
      [tenantId, email, shopName, clerkUserId],
    )
    return res.rows[0].id as string
  })

  return { tenantId, userId }
})

// Convenience: just the tenant uuid.
export async function getTenantId(): Promise<string> {
  return (await getTenantContext()).tenantId
}
