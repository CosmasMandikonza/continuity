import { query } from '@/lib/db'
import { embedText, toVectorLiteral } from '@/lib/embed'
import { deviceIdByName } from '@/lib/queries'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEVICE_NAME = 'MNT Reform'

// One-time backfill: embed every confirmed seeded finding that has no vector yet,
// so pgvector cosine search has something to match against. Idempotent — only
// touches findings whose embedding IS NULL, so it is safe to re-run.
//
// Usage (once, after setting COHERE_API_KEY and BACKFILL_SECRET in Vercel):
//   curl -X POST "https://<app>/api/embed-backfill?secret=<BACKFILL_SECRET>"
async function run(req: Request): Promise<Response> {
  const secret = process.env.BACKFILL_SECRET
  const url = new URL(req.url)
  const given =
    url.searchParams.get('secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

  if (!secret || given !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const deviceId = await deviceIdByName(DEVICE_NAME)
  if (!deviceId) {
    return Response.json({ error: `device not found: ${DEVICE_NAME}` }, { status: 404 })
  }

  const { rows } = await query('SELECT * FROM findings_needing_embedding($1::uuid)', [deviceId])
  const pending = rows as Array<{ finding_id: string; doc: string }>

  let embedded = 0
  const errors: string[] = []
  for (const row of pending) {
    try {
      const vec = await embedText(row.doc, 'search_document')
      await query('SELECT set_finding_embedding($1::uuid, $2::vector)', [
        row.finding_id,
        toVectorLiteral(vec),
      ])
      embedded += 1
    } catch (err) {
      errors.push(`${row.finding_id}: ${(err as Error).message}`)
    }
  }

  return Response.json({ device: DEVICE_NAME, pending: pending.length, embedded, errors })
}

export async function POST(req: Request) {
  return run(req)
}

// Allow GET too, so it can be triggered straight from a browser address bar.
export async function GET(req: Request) {
  return run(req)
}
