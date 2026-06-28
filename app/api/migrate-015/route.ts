import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

// One-time migration 015 — installs shop_similar_findings (tenant-scoped semantic
// case retrieval), so each shop's pgvector recall is over its OWN confirmed cases.
// Idempotent (CREATE OR REPLACE). Secret-protected with BACKFILL_SECRET. Call:
//   /api/migrate-015?secret=YOUR_BACKFILL_SECRET
const SQL = `
CREATE OR REPLACE FUNCTION shop_similar_findings(
  p_embedding vector,
  p_device    UUID,
  p_tenant    UUID,
  p_k         INT DEFAULT 8
)
RETURNS TABLE (
  refdes     VARCHAR,
  net        VARCHAR,
  kind       VARCHAR,
  confidence NUMERIC,
  symptom    TEXT,
  similarity NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    c.refdes,
    n.name,
    f.kind,
    f.confidence,
    r.symptom,
    round((1 - (f.embedding <=> p_embedding))::numeric, 4) AS similarity
  FROM findings f
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device AND r.tenant_id = p_tenant
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NOT NULL
    AND f.status = 'confirmed'
  ORDER BY f.embedding <=> p_embedding
  LIMIT GREATEST(p_k, 1)
$func$;
GRANT EXECUTE ON FUNCTION shop_similar_findings(vector, UUID, UUID, INT) TO PUBLIC;
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
    const check = await query<{ has_fn: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_similar_findings') AS has_fn`,
    )
    return Response.json({ ok: true, shopSimilarFindings: check.rows[0]?.has_fn ?? false })
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
