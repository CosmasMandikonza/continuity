import type { PoolClient } from 'pg'
import { query } from './db'
import { embedText, toVectorLiteral } from './embed'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TraceNode {
  componentId: string
  refdes: string
  kind: string
  value: string | null
  hop: number
  edgeKind: string | null
  viaNet: string | null
}

export interface NetMember {
  componentId: string
  refdes: string
  kind: string
  pinNumber: string
  pinName: string | null
  role: string | null
}

export interface FailureRateRow {
  componentId: string
  refdes: string
  kind: string
  rootCauses: number
  totalRepairs: number
  pct: number
}

// The provenance card is DERIVED here from component + pin + net joins.
// It is NOT a stored card.
export interface ProvenanceCard {
  componentId: string
  refdes: string
  kind: string
  value: string | null
  package: string | null
  mpn: string | null
  sourceRef: string | null
  confidence: number | null
  nets: { name: string; netClass: string | null; nominalV: number | null; role: string | null }[]
}

// ---------------------------------------------------------------------------
// netTrace — WITH RECURSIVE walk of the electrical graph (the showpiece).
// Returns every component electrically connected to startRefdes within maxHops,
// with hop distance and the edge that reached it.
// ---------------------------------------------------------------------------
export async function netTrace(
  deviceId: string,
  startRefdes: string,
  maxHops: number,
): Promise<TraceNode[]> {
  const sql = `
    WITH RECURSIVE start AS (
      SELECT id FROM components WHERE device_id = $1 AND refdes = $2
    ),
    walk AS (
      SELECT c.id AS component_id, 0 AS hop,
             NULL::varchar AS edge_kind, NULL::uuid AS via_net_id
      FROM components c JOIN start s ON s.id = c.id
      UNION ALL
      SELECT nb.neighbor, w.hop + 1, nb.kind, nb.via_net_id
      FROM walk w
      JOIN LATERAL (
        SELECT e.dst_component_id AS neighbor, e.kind, e.via_net_id
        FROM edges e WHERE e.src_component_id = w.component_id AND e.device_id = $1
        UNION ALL
        SELECT e.src_component_id AS neighbor, e.kind, e.via_net_id
        FROM edges e WHERE e.dst_component_id = w.component_id AND e.device_id = $1
      ) nb ON true
      WHERE w.hop < $3
    ),
    nearest AS (
      SELECT DISTINCT ON (component_id)
             component_id, hop, edge_kind, via_net_id
      FROM walk
      ORDER BY component_id, hop
    )
    SELECT n.component_id, c.refdes, c.kind, c.value,
           n.hop, n.edge_kind, net.name AS via_net
    FROM nearest n
    JOIN components c ON c.id = n.component_id
    LEFT JOIN nets net ON net.id = n.via_net_id
    ORDER BY n.hop, c.refdes;
  `
  const { rows } = await query(sql, [deviceId, startRefdes, maxHops])
  return rows.map((r) => ({
    componentId: r.component_id as string,
    refdes: r.refdes as string,
    kind: r.kind as string,
    value: r.value as string | null,
    hop: Number(r.hop),
    edgeKind: r.edge_kind as string | null,
    viaNet: r.via_net as string | null,
  }))
}

// ---------------------------------------------------------------------------
// netMembers — all pins + components on a named net.
// ---------------------------------------------------------------------------
export async function netMembers(deviceId: string, netName: string): Promise<NetMember[]> {
  const sql = `
    SELECT c.id AS component_id, c.refdes, c.kind,
           p.number AS pin_number, p.name AS pin_name, p.role
    FROM nets n
    JOIN pins p ON p.net_id = n.id
    JOIN components c ON c.id = p.component_id
    WHERE n.device_id = $1 AND n.name = $2
    ORDER BY c.refdes, p.number;
  `
  const { rows } = await query(sql, [deviceId, netName])
  return rows.map((r) => ({
    componentId: r.component_id as string,
    refdes: r.refdes as string,
    kind: r.kind as string,
    pinNumber: r.pin_number as string,
    pinName: r.pin_name as string | null,
    role: r.role as string | null,
  }))
}

// ---------------------------------------------------------------------------
// failureRate — cross-tenant aggregate via SECURITY DEFINER function.
// ---------------------------------------------------------------------------
export async function failureRate(deviceId: string, symptom: string): Promise<FailureRateRow[]> {
  const { rows } = await query('SELECT * FROM failure_rate($1, $2)', [deviceId, symptom])
  return rows.map((r) => ({
    componentId: r.component_id as string,
    refdes: r.refdes as string,
    kind: r.kind as string,
    rootCauses: Number(r.root_causes),
    totalRepairs: Number(r.total_repairs),
    pct: Number(r.pct),
  }))
}

// ---------------------------------------------------------------------------
// netCard — DERIVED card for a named net: its class/nominal plus live member
// counts from the pins join. Mirrors provenanceCard but for a net chip.
// ---------------------------------------------------------------------------
export interface NetCard {
  name: string
  netClass: string | null
  nominalV: number | null
  pinCount: number
  componentCount: number
  source: string | null
}

export async function netCard(deviceId: string, netName: string): Promise<NetCard | null> {
  const sql = `
    SELECT n.name, n.net_class, n.nominal_v,
           count(p.id)                         AS pin_count,
           count(DISTINCT p.component_id)      AS component_count,
           string_agg(DISTINCT c.refdes, ', ' ORDER BY c.refdes) AS members
    FROM nets n
    LEFT JOIN pins p ON p.net_id = n.id
    LEFT JOIN components c ON c.id = p.component_id
    WHERE n.device_id = $1 AND n.name = $2
    GROUP BY n.id, n.name, n.net_class, n.nominal_v;
  `
  const { rows } = await query(sql, [deviceId, netName])
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    name: r.name as string,
    netClass: r.net_class as string | null,
    nominalV: r.nominal_v != null ? Number(r.nominal_v) : null,
    pinCount: Number(r.pin_count),
    componentCount: Number(r.component_count),
    source: r.members as string | null,
  }
}

// ---------------------------------------------------------------------------
// deviceIdByName — resolve a shared reference device to its id by name.
// ---------------------------------------------------------------------------
export async function deviceIdByName(name: string): Promise<string | null> {
  const { rows } = await query(
    'SELECT id FROM devices WHERE name = $1 AND is_shared = true LIMIT 1',
    [name],
  )
  return rows.length ? (rows[0].id as string) : null
}

// ---------------------------------------------------------------------------
// fleetSummary — the "only-possible-with-a-database" readout. Combines the top
// cross-shop root cause with the distinct shop count, both from SECURITY
// DEFINER aggregates that never leak tenant rows.
// ---------------------------------------------------------------------------
export interface FleetSummary {
  refdes: string
  kind: string
  pct: number
  rootCauses: number
  totalRepairs: number
  shops: number
  symptom: string
}

export async function fleetSummary(
  deviceName: string,
  symptom: string,
): Promise<FleetSummary | null> {
  const deviceId = await deviceIdByName(deviceName)
  if (!deviceId) return null

  const rates = await failureRate(deviceId, symptom)
  if (rates.length === 0) return null
  const top = rates[0]

  const { rows } = await query('SELECT fleet_shops($1, $2) AS shops', [deviceId, symptom])
  const shops = rows.length ? Number(rows[0].shops) : 0

  return {
    refdes: top.refdes,
    kind: top.kind,
    pct: top.pct,
    rootCauses: top.rootCauses,
    totalRepairs: top.totalRepairs,
    shops,
    symptom,
  }
}

// ---------------------------------------------------------------------------
// provenanceCard — the card the UI shows, DERIVED by joining a component to its
// pins/nets. Never read from a stored "cards" table.
// ---------------------------------------------------------------------------
export async function provenanceCard(
  deviceId: string,
  refdes: string,
): Promise<ProvenanceCard | null> {
  const compSql = `
    SELECT id, refdes, kind, value, package, mpn, source_ref, confidence
    FROM components WHERE device_id = $1 AND refdes = $2;
  `
  const { rows: comp } = await query(compSql, [deviceId, refdes])
  if (comp.length === 0) return null
  const c = comp[0]

  const netSql = `
    SELECT DISTINCT n.name, n.net_class, n.nominal_v, p.role
    FROM pins p
    JOIN nets n ON n.id = p.net_id
    WHERE p.component_id = $1
    ORDER BY n.name;
  `
  const { rows: nets } = await query(netSql, [c.id])

  return {
    componentId: c.id as string,
    refdes: c.refdes as string,
    kind: c.kind as string,
    value: c.value as string | null,
    package: c.package as string | null,
    mpn: c.mpn as string | null,
    sourceRef: c.source_ref as string | null,
    confidence: c.confidence != null ? Number(c.confidence) : null,
    nets: nets.map((n) => ({
      name: n.name as string,
      netClass: n.net_class as string | null,
      nominalV: n.nominal_v != null ? Number(n.nominal_v) : null,
      role: n.role as string | null,
    })),
  }
}

// ===========================================================================
// AGENT SURFACES — the only way the live diagnostic agent learns the board.
// Reads resolve refdes/net to real rows; an unknown reference returns found:false
// so the model can say "no such part" instead of inventing one.
// ===========================================================================

// Nets we never walk through on a generic hop: ground + high-fanout power rails
// would make traceNet report "everything is connected".
const RAIL_NETS = new Set(['GND', 'PGND', 'AGND'])

export interface TraceResult {
  found: boolean
  start?: { refdes: string; kind: string }
  onRail?: string | null
  nodes: TraceNode[]
}

// traceNet — walk the electrical graph from a refdes, excluding GND/high-fanout
// rails. If the start sits ON such a rail, return its regulator/source + the
// immediate neighbours only (don't fan out across the whole rail).
export async function traceNet(
  deviceId: string,
  startRefdes: string,
  maxHops = 3,
): Promise<TraceResult> {
  const { rows: startRows } = await query(
    'SELECT id, refdes, kind FROM components WHERE device_id = $1 AND refdes = $2',
    [deviceId, startRefdes],
  )
  if (startRows.length === 0) return { found: false, nodes: [] }
  const start = startRows[0]

  // Is the start component itself sitting on a high-fanout rail?
  const { rows: railRows } = await query(
    `SELECT DISTINCT n.name, n.net_class,
            (SELECT count(*) FROM pins p2 WHERE p2.net_id = n.id) AS fanout
     FROM pins p JOIN nets n ON n.id = p.net_id
     WHERE p.component_id = $1`,
    [start.id],
  )
  const onRail =
    railRows.find(
      (r) => RAIL_NETS.has(r.name as string) || Number(r.fanout) > 24,
    )?.name as string | undefined

  const all = await netTrace(deviceId, startRefdes, maxHops)

  // Drop neighbours reached purely via a GND/high-fanout rail edge.
  const nodes = all.filter(
    (n) => n.hop === 0 || !n.viaNet || !RAIL_NETS.has(n.viaNet),
  )

  // If start is on a rail, keep it tight: hop 0 + hop 1 only.
  const scoped = onRail ? nodes.filter((n) => n.hop <= 1) : nodes

  return {
    found: true,
    start: { refdes: start.refdes as string, kind: start.kind as string },
    onRail: onRail ?? null,
    nodes: scoped,
  }
}

// ---------------------------------------------------------------------------
// Repair-domain WRITES — every one runs inside withTenant(...) so RLS applies.
// ---------------------------------------------------------------------------

export async function createRepair(
  client: PoolClient,
  tenantId: string,
  deviceId: string,
  userId: string,
  ref: string,
  symptom: string,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO repairs (tenant_id, device_id, user_id, ref, status, symptom)
     VALUES ($1, $2, $3, $4, 'open', $5) RETURNING id`,
    [tenantId, deviceId, userId, ref, symptom],
  )
  return rows[0].id as string
}

export async function saveMessage(
  client: PoolClient,
  repairId: string,
  role: 'tech' | 'agent',
  content: unknown,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO messages (repair_id, role, content)
     VALUES ($1, $2, $3) RETURNING id`,
    [repairId, role, JSON.stringify(content)],
  )
  return rows[0].id as string
}

export interface MeasurementInput {
  net?: string | null
  refdes?: string | null
  kind: string
  value: number
  unit?: string | null
  expected?: number | null
}

export async function recordMeasurementRow(
  client: PoolClient,
  deviceId: string,
  repairId: string,
  m: MeasurementInput,
) {
  const netId = m.net ? await resolveNetId(client, deviceId, m.net) : null
  const compId = m.refdes ? await resolveComponentId(client, deviceId, m.refdes) : null
  const { rows } = await client.query(
    `INSERT INTO measurements (repair_id, net_id, component_id, kind, value, unit, expected)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, kind, value, unit, expected`,
    [repairId, netId, compId, m.kind, m.value, m.unit ?? null, m.expected ?? null],
  )
  return rows[0]
}

export async function proposeFindingRow(
  client: PoolClient,
  deviceId: string,
  repairId: string,
  refdes: string,
  net: string | null,
  kind: string,
  confidence: number,
): Promise<string> {
  const compId = await resolveComponentId(client, deviceId, refdes)
  const netId = net ? await resolveNetId(client, deviceId, net) : null
  const { rows } = await client.query(
    `INSERT INTO findings (repair_id, component_id, net_id, kind, confidence, status)
     VALUES ($1, $2, $3, $4, $5, 'proposed') RETURNING id`,
    [repairId, compId, netId, kind, confidence],
  )
  return rows[0].id as string
}

export async function saveCitation(
  client: PoolClient,
  messageId: string,
  refType: 'component' | 'net',
  refId: string,
  source: string | null,
) {
  await client.query(
    `INSERT INTO citations (message_id, ref_type, ref_id, source)
     VALUES ($1, $2, $3, $4)`,
    [messageId, refType, refId, source],
  )
}

export async function saveVerification(
  client: PoolClient,
  findingId: string,
  verified: boolean,
  checks: unknown,
) {
  await client.query(
    `UPDATE findings SET verified = $2, verification = $3 WHERE id = $1`,
    [findingId, verified, JSON.stringify(checks)],
  )
}

// ---------------------------------------------------------------------------
// Resolvers (RLS-safe — work on shared device rows visible to every tenant).
// ---------------------------------------------------------------------------

export async function resolveComponentId(
  client: PoolClient,
  deviceId: string,
  refdes: string,
): Promise<string | null> {
  const { rows } = await client.query(
    'SELECT id FROM components WHERE device_id = $1 AND refdes = $2',
    [deviceId, refdes],
  )
  return rows.length ? (rows[0].id as string) : null
}

export async function resolveNetId(
  client: PoolClient,
  deviceId: string,
  net: string,
): Promise<string | null> {
  const { rows } = await client.query(
    'SELECT id FROM nets WHERE device_id = $1 AND name = $2',
    [deviceId, net],
  )
  return rows.length ? (rows[0].id as string) : null
}

// ---------------------------------------------------------------------------
// Per-tenant monthly meter. Returns the post-increment usage, or over:true when
// the quota is already spent (no increment in that case).
// ---------------------------------------------------------------------------
export interface MeterResult {
  used: number
  quota: number
  over: boolean
}

export async function meterTenant(
  client: PoolClient,
  tenantId: string,
  period: string,
): Promise<MeterResult> {
  // Ensure the row exists for this period.
  await client.query(
    `INSERT INTO tenant_usage (tenant_id, period, used, quota)
     VALUES ($1, $2, 0, 500) ON CONFLICT (tenant_id, period) DO NOTHING`,
    [tenantId, period],
  )
  const { rows } = await client.query(
    'SELECT used, quota FROM tenant_usage WHERE tenant_id = $1 AND period = $2',
    [tenantId, period],
  )
  const used = Number(rows[0].used)
  const quota = Number(rows[0].quota)
  if (used >= quota) return { used, quota, over: true }

  const { rows: inc } = await client.query(
    `UPDATE tenant_usage SET used = used + 1
     WHERE tenant_id = $1 AND period = $2 RETURNING used, quota`,
    [tenantId, period],
  )
  return { used: Number(inc[0].used), quota: Number(inc[0].quota), over: false }
}

// Read-only current usage for a tenant/period (no increment). Backs the
// faceplate meter pill on first paint so it shows the signed-in shop's real
// count. A shop with no diagnostics yet reads 0/500.
export async function readTenantUsage(
  client: PoolClient,
  tenantId: string,
  period: string,
): Promise<{ used: number; quota: number }> {
  const { rows } = await client.query(
    'SELECT used, quota FROM tenant_usage WHERE tenant_id = $1 AND period = $2',
    [tenantId, period],
  )
  if (!rows.length) return { used: 0, quota: 500 }
  return { used: Number(rows[0].used), quota: Number(rows[0].quota) }
}

// ===========================================================================
// VIEW SURFACES — read models for the multi-view product (shell pages).
// ===========================================================================

// ---------------------------------------------------------------------------
// getGraph — the device's electrical graph as a component↔net incidence graph
// (the faithful schematic shape). Backs the Knowledge Graph view, which renders
// the database live (no x/y is stored; the client lays it out). Shared-device
// rows are visible to every tenant, so this uses the unscoped reader.
// ---------------------------------------------------------------------------
export interface GraphComponentNode {
  refdes: string
  kind: string
  value: string | null
}
export interface GraphNetNode {
  name: string
  netClass: string | null
  nominalV: number | null
}
export interface GraphLink {
  comp: string
  net: string
}
export interface DeviceGraph {
  components: GraphComponentNode[]
  nets: GraphNetNode[]
  links: GraphLink[]
}

export async function getGraph(deviceId: string): Promise<DeviceGraph> {
  const [comps, nets, links] = await Promise.all([
    query(
      `SELECT refdes, kind, value FROM components WHERE device_id = $1 ORDER BY refdes`,
      [deviceId],
    ),
    query(
      `SELECT name, net_class, nominal_v FROM nets WHERE device_id = $1 ORDER BY name`,
      [deviceId],
    ),
    query(
      `SELECT DISTINCT c.refdes AS comp, n.name AS net
       FROM pins p
       JOIN components c ON c.id = p.component_id
       JOIN nets n ON n.id = p.net_id
       WHERE c.device_id = $1
       ORDER BY c.refdes, n.name`,
      [deviceId],
    ),
  ])
  return {
    components: comps.rows.map((r) => ({
      refdes: r.refdes as string,
      kind: r.kind as string,
      value: r.value as string | null,
    })),
    nets: nets.rows.map((r) => ({
      name: r.name as string,
      netClass: r.net_class as string | null,
      nominalV: r.nominal_v != null ? Number(r.nominal_v) : null,
    })),
    links: links.rows.map((r) => ({ comp: r.comp as string, net: r.net as string })),
  }
}

// ---------------------------------------------------------------------------
// listRepairs — the signed-in shop's repair history (RLS-scoped: call inside
// withTenant). Each row carries its latest finding so the list can show the
// culprit and whether the verifier confirmed it.
// ---------------------------------------------------------------------------
export interface RepairListItem {
  id: string
  ref: string
  deviceName: string
  symptom: string | null
  status: string
  createdAt: string
  findingRefdes: string | null
  findingKind: string | null
  findingVerified: boolean | null
  findingConfidence: number | null
}

export async function listRepairs(
  client: PoolClient,
  tenantId: string,
): Promise<RepairListItem[]> {
  const { rows } = await client.query(
    `SELECT r.id, r.ref, r.symptom, r.status, r.created_at,
            d.name AS device_name,
            f.refdes AS finding_refdes, f.kind AS finding_kind,
            f.verified AS finding_verified, f.confidence AS finding_confidence
     FROM repairs r
     JOIN devices d ON d.id = r.device_id
     LEFT JOIN LATERAL (
       SELECT c.refdes, fi.kind, fi.verified, fi.confidence
       FROM findings fi
       LEFT JOIN components c ON c.id = fi.component_id
       WHERE fi.repair_id = r.id
       ORDER BY fi.created_at DESC
       LIMIT 1
     ) f ON true
     WHERE r.tenant_id = $1
     ORDER BY r.created_at DESC
     LIMIT 100`,
    [tenantId],
  )
  return rows.map((r) => ({
    id: r.id as string,
    ref: r.ref as string,
    deviceName: r.device_name as string,
    symptom: r.symptom as string | null,
    status: r.status as string,
    createdAt: (r.created_at as Date).toISOString(),
    findingRefdes: r.finding_refdes as string | null,
    findingKind: r.finding_kind as string | null,
    findingVerified: r.finding_verified as boolean | null,
    findingConfidence: r.finding_confidence != null ? Number(r.finding_confidence) : null,
  }))
}

// ---------------------------------------------------------------------------
// getRepairDetail — one repair's full record (RLS-scoped: call inside
// withTenant; only the owning shop can read it). Returns the transcript, the
// measurements, and the findings + the verifier's stamp.
// ---------------------------------------------------------------------------
export interface RepairMessage {
  id: string
  role: string
  text: string
  createdAt: string
}
export interface RepairMeasurement {
  id: string
  kind: string
  value: number | null
  unit: string | null
  expected: number | null
  target: string | null
  createdAt: string
}
export interface RepairFinding {
  id: string
  refdes: string | null
  net: string | null
  kind: string
  confidence: number | null
  status: string
  verified: boolean | null
  createdAt: string
}
export interface RepairDetail {
  id: string
  ref: string
  deviceName: string
  symptom: string | null
  status: string
  createdAt: string
  messages: RepairMessage[]
  measurements: RepairMeasurement[]
  findings: RepairFinding[]
}

function messageText(content: unknown): string {
  if (content && typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
    return String((content as Record<string, unknown>).text ?? '')
  }
  return typeof content === 'string' ? content : ''
}

export async function getRepairDetail(
  client: PoolClient,
  repairId: string,
): Promise<RepairDetail | null> {
  const { rows: head } = await client.query(
    `SELECT r.id, r.ref, r.symptom, r.status, r.created_at, d.name AS device_name
     FROM repairs r JOIN devices d ON d.id = r.device_id
     WHERE r.id = $1`,
    [repairId],
  )
  if (head.length === 0) return null
  const h = head[0]

  const { rows: msgs } = await client.query(
    `SELECT id, role, content, created_at FROM messages
     WHERE repair_id = $1 ORDER BY created_at`,
    [repairId],
  )
  const { rows: meas } = await client.query(
    `SELECT m.id, m.kind, m.value, m.unit, m.expected, m.created_at,
            c.refdes AS comp_refdes, n.name AS net_name
     FROM measurements m
     LEFT JOIN components c ON c.id = m.component_id
     LEFT JOIN nets n ON n.id = m.net_id
     WHERE m.repair_id = $1 ORDER BY m.created_at`,
    [repairId],
  )
  const { rows: finds } = await client.query(
    `SELECT f.id, f.kind, f.confidence, f.status, f.verified, f.created_at,
            c.refdes AS comp_refdes, n.name AS net_name
     FROM findings f
     LEFT JOIN components c ON c.id = f.component_id
     LEFT JOIN nets n ON n.id = f.net_id
     WHERE f.repair_id = $1 ORDER BY f.created_at`,
    [repairId],
  )

  return {
    id: h.id as string,
    ref: h.ref as string,
    deviceName: h.device_name as string,
    symptom: h.symptom as string | null,
    status: h.status as string,
    createdAt: (h.created_at as Date).toISOString(),
    messages: msgs.map((m) => ({
      id: m.id as string,
      role: m.role as string,
      text: messageText(m.content),
      createdAt: (m.created_at as Date).toISOString(),
    })),
    measurements: meas.map((m) => ({
      id: m.id as string,
      kind: m.kind as string,
      value: m.value != null ? Number(m.value) : null,
      unit: m.unit as string | null,
      expected: m.expected != null ? Number(m.expected) : null,
      target: (m.comp_refdes as string | null) ?? (m.net_name as string | null),
      createdAt: (m.created_at as Date).toISOString(),
    })),
    findings: finds.map((f) => ({
      id: f.id as string,
      refdes: f.comp_refdes as string | null,
      net: f.net_name as string | null,
      kind: f.kind as string,
      confidence: f.confidence != null ? Number(f.confidence) : null,
      status: f.status as string,
      verified: f.verified as boolean | null,
      createdAt: (f.created_at as Date).toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// fleetBreakdown — the full cross-shop root-cause distribution for a symptom,
// plus the contributing-shop count. Every number comes from the SECURITY
// DEFINER aggregates, which read past RLS but return only percentages — never
// another shop's rows. Backs the Fleet / Insights view.
// ---------------------------------------------------------------------------
export interface FleetBreakdown {
  symptom: string
  shops: number
  totalRepairs: number
  rows: FailureRateRow[]
}

export async function fleetBreakdown(
  deviceName: string,
  symptom: string,
): Promise<FleetBreakdown | null> {
  const deviceId = await deviceIdByName(deviceName)
  if (!deviceId) return null
  const rows = await failureRate(deviceId, symptom)
  const { rows: s } = await query('SELECT fleet_shops($1, $2) AS shops', [deviceId, symptom])
  const shops = s.length ? Number(s[0].shops) : 0
  const totalRepairs = rows[0]?.totalRepairs ?? 0
  return { symptom, shops, totalRepairs, rows }
}

// ---------------------------------------------------------------------------
// similarCases — pgvector semantic retrieval. Embeds the free-text symptom as a
// query vector and returns the closest CONFIRMED past cases across the fleet by
// cosine distance (HNSW index). Complements failureRate(): that needs an exact
// symptom string; this finds relevant history from any phrasing.
// ---------------------------------------------------------------------------
export interface SimilarCaseRow {
  refdes: string | null
  net: string | null
  kind: string
  confidence: number | null
  symptom: string | null
  similarity: number
}

export async function similarCases(
  symptom: string,
  deviceId: string,
  k = 8,
): Promise<SimilarCaseRow[]> {
  const emb = await embedText(symptom, 'search_query')
  const { rows } = await query('SELECT * FROM similar_findings($1::vector, $2::uuid, $3::int)', [
    toVectorLiteral(emb),
    deviceId,
    k,
  ])
  return rows.map((r) => ({
    refdes: (r.refdes as string | null) ?? null,
    net: (r.net as string | null) ?? null,
    kind: r.kind as string,
    confidence: r.confidence != null ? Number(r.confidence) : null,
    symptom: (r.symptom as string | null) ?? null,
    similarity: Number(r.similarity),
  }))
}
