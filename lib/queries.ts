import { query } from './db'

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
