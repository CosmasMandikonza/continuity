import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

// One-time migration 014 — run it once after deploy to add the Clerk Organization
// -> tenant mapping. Idempotent (ADD COLUMN / CREATE INDEX IF NOT EXISTS), so it is
// safe to call more than once. Secret-protected with BACKFILL_SECRET (the same env
// var used by the pgvector backfill). Call:
//   /api/migrate-014?secret=YOUR_BACKFILL_SECRET
const SQL = `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_clerk_org_id_key
  ON tenants (clerk_org_id) WHERE clerk_org_id IS NOT NULL;
`

function authorized(req: Request): boolean {
  const secret = process.env.BACKFILL_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('secret')
  const fromHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return fromQuery === secret || fromHeader === secret
}

async function run(req: Request) {
  if (!authorized(req)) {
    return Response.json(
      { ok: false, error: 'unauthorized — pass ?secret=BACKFILL_SECRET' },
      { status: 401 },
    )
  }
  try {
    await query(SQL)
    const check = await query<{ has_col: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'tenants' AND column_name = 'clerk_org_id'
       ) AS has_col`,
    )
    return Response.json({ ok: true, clerkOrgIdColumn: check.rows[0]?.has_col ?? false })
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return run(req)
}
export async function POST(req: Request) {
  return run(req)
}
