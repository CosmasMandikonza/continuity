import { query } from '@/lib/db'
import { deviceIdByName } from '@/lib/queries'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEVICE_NAME = 'MNT Reform'

// The 013 functions, created from inside the Vercel runtime (where the app's IAM
// DB connection already works). This only succeeds if the app's database role can
// read the seeded fleet cases past RLS — which the route checks BEFORE creating
// anything, so it can never leave broken functions behind.

const SQL_SIMILAR = `CREATE OR REPLACE FUNCTION similar_findings(
  p_embedding vector,
  p_device    UUID,
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
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NOT NULL
    AND f.status = 'confirmed'
  ORDER BY f.embedding <=> p_embedding
  LIMIT GREATEST(p_k, 1)
$func$;`

const SQL_NEEDING = `CREATE OR REPLACE FUNCTION findings_needing_embedding(p_device UUID)
RETURNS TABLE (finding_id UUID, doc TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT
    f.id,
    'Symptom: ' || coalesce(r.symptom, 'unknown')
      || '. Confirmed root cause on this board: ' || coalesce(c.refdes, 'unknown')
      || coalesce(', rail ' || n.name, '') AS doc
  FROM findings f
  JOIN repairs r ON r.id = f.repair_id AND r.device_id = p_device
  LEFT JOIN components c ON c.id = f.component_id
  LEFT JOIN nets n ON n.id = f.net_id
  WHERE f.embedding IS NULL
    AND f.status = 'confirmed'
$func$;`

const SQL_SET = `CREATE OR REPLACE FUNCTION set_finding_embedding(p_id UUID, p_embedding vector)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  UPDATE findings SET embedding = p_embedding WHERE id = p_id
$func$;`

const SQL_GRANTS = `GRANT EXECUTE ON FUNCTION similar_findings(vector, UUID, INT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION findings_needing_embedding(UUID) TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_finding_embedding(UUID, vector) TO PUBLIC;`

function authorized(req: Request): boolean {
  const secret = process.env.BACKFILL_SECRET
  if (!secret) return false
  const url = new URL(req.url)
  const given =
    url.searchParams.get('secret') ||
    (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  return given === secret
}

async function run(req: Request): Promise<Response> {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  // 1) Read-only probe. Can the app role see the seeded confirmed findings with NO
  //    tenant set? If not, it is RLS-scoped and any function it creates is blocked too,
  //    so we create nothing and report that a privileged console is required.
  let visible: number
  try {
    const { rows } = await query("SELECT count(*)::int AS n FROM findings WHERE status = 'confirmed'")
    visible = Number(rows[0]?.n ?? 0)
  } catch (err) {
    return Response.json({ ok: false, step: 'probe', error: (err as Error).message }, { status: 500 })
  }

  if (visible < 1) {
    return Response.json({
      ok: false,
      reason: 'app_role_is_rls_scoped',
      visibleConfirmedFindings: visible,
      message:
        'The app database role is row-level-security scoped: it cannot read the seeded fleet cases directly, so functions it creates would be blocked too. Nothing was created. These functions must be created by the privileged role that owns failure_rate — i.e. a SQL console using the Aurora master credentials.',
    })
  }

  // 2) The role can read the fleet → create the functions as this role.
  try {
    await query(SQL_SIMILAR)
    await query(SQL_NEEDING)
    await query(SQL_SET)
    await query(SQL_GRANTS)
  } catch (err) {
    return Response.json(
      {
        ok: false,
        step: 'create',
        error: (err as Error).message,
        hint: 'The role can read the data but could not CREATE the functions (likely missing CREATE on schema public). Create 013 via a console with the master role instead.',
      },
      { status: 500 },
    )
  }

  // 3) Verify the new function actually returns the fleet cases.
  let pending: number
  try {
    const deviceId = await deviceIdByName(DEVICE_NAME)
    if (!deviceId) {
      return Response.json({ ok: false, step: 'verify', error: `device not found: ${DEVICE_NAME}` }, { status: 404 })
    }
    const { rows } = await query('SELECT count(*)::int AS n FROM findings_needing_embedding($1::uuid)', [deviceId])
    pending = Number(rows[0]?.n ?? 0)
  } catch (err) {
    return Response.json({ ok: false, step: 'verify', error: (err as Error).message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    functionsCreated: true,
    pendingEmbeddings: pending,
    next: 'Now open /api/embed-backfill?secret=YOUR_SECRET to generate the embeddings.',
  })
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
