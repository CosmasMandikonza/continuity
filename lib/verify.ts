// Continuity — DETERMINISTIC verification layer. Pure SQL/TS, NOT an LLM.
// The agent PROPOSES a finding; this code adjudicates it against real rows
// before the UI is ever allowed to show it as fact. Nothing here calls a model.

import type { PoolClient } from 'pg'
import { query } from './db'
import { traceNet, netMembers, type MeasurementInput } from './queries'

export interface VerificationCheck {
  id: string
  label: string
  pass: boolean
  detail: string
}

export interface VerificationResult {
  verified: boolean
  checks: VerificationCheck[]
}

export interface FindingToVerify {
  refdes: string
  net: string | null
  kind: string // 'short' | 'rail_collapse' | 'open' | ...
}

// Measurements recorded so far on this repair (read tenant-scoped via client).
async function repairMeasurements(client: PoolClient, repairId: string) {
  const { rows } = await client.query(
    `SELECT m.kind, m.value, m.unit, m.expected,
            c.refdes AS comp_refdes, n.name AS net_name, n.nominal_v
     FROM measurements m
     LEFT JOIN components c ON c.id = m.component_id
     LEFT JOIN nets n ON n.id = m.net_id
     WHERE m.repair_id = $1`,
    [repairId],
  )
  return rows
}

export async function verifyFinding(
  client: PoolClient,
  deviceId: string,
  repairId: string,
  finding: FindingToVerify,
  citedRefs: { refdes: string[]; nets: string[] },
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = []

  // (i) component AND net resolve to real rows for this device.
  const { rows: comp } = await query(
    'SELECT id, refdes FROM components WHERE device_id = $1 AND refdes = $2',
    [deviceId, finding.refdes],
  )
  const compResolves = comp.length > 0
  let netResolves = true
  if (finding.net) {
    const { rows: net } = await query(
      'SELECT id FROM nets WHERE device_id = $1 AND name = $2',
      [deviceId, finding.net],
    )
    netResolves = net.length > 0
  }
  checks.push({
    id: 'resolves',
    label: 'component & net are real rows',
    pass: compResolves && netResolves,
    detail: compResolves
      ? `${finding.refdes}${finding.net ? ` on ${finding.net}` : ''} found`
      : `no component ${finding.refdes} on this device`,
  })

  // (ii) the component is electrically related to the failing net — it must
  // appear in the traced path / on the net, not be arbitrary.
  let electricallyRelated = false
  let relDetail = 'no failing net supplied'
  if (finding.net) {
    const members = await netMembers(deviceId, finding.net)
    const onNet = members.some((m) => m.refdes === finding.refdes)
    if (onNet) {
      electricallyRelated = true
      relDetail = `${finding.refdes} sits directly on ${finding.net}`
    } else {
      // Fall back to a trace from the component: is the net reachable?
      const trace = await traceNet(deviceId, finding.refdes, 3)
      const reaches = trace.nodes.some((n) => n.viaNet === finding.net)
      electricallyRelated = reaches
      relDetail = reaches
        ? `${finding.refdes} traces to ${finding.net} within 3 hops`
        : `${finding.refdes} is not electrically related to ${finding.net}`
    }
  }
  checks.push({
    id: 'electrical',
    label: 'component lies on the path to the failing net',
    pass: electricallyRelated,
    detail: relDetail,
  })

  // (iii) measurement -> finding chain is consistent.
  const meas = await repairMeasurements(client, repairId)
  let chainConsistent = false
  let chainDetail = 'no supporting measurement recorded'
  const kind = finding.kind.toLowerCase()

  if (kind.includes('short')) {
    // A short requires a recorded low-resistance measurement on that net/component.
    const hit = meas.find(
      (m) =>
        (m.kind as string).toLowerCase().includes('resist') &&
        (m.comp_refdes === finding.refdes || m.net_name === finding.net) &&
        m.value != null &&
        Number(m.value) < 10,
    )
    chainConsistent = Boolean(hit)
    chainDetail = hit
      ? `low resistance ${Number(hit.value)} ${hit.unit ?? 'Ω'} measured on ${
          hit.comp_refdes ?? hit.net_name
        }`
      : 'a short needs a measured low resistance (<10 Ω) on the part/net'
  } else if (kind.includes('rail') || kind.includes('collapse') || kind.includes('voltage')) {
    // A rail collapse requires a measured voltage well below the net's nominal.
    const hit = meas.find((m) => {
      if (!(m.kind as string).toLowerCase().includes('volt')) return false
      if (m.net_name !== finding.net) return false
      const nominal = m.nominal_v != null ? Number(m.nominal_v) : null
      if (nominal == null || m.value == null) return false
      return Number(m.value) < nominal * 0.5
    })
    chainConsistent = Boolean(hit)
    chainDetail = hit
      ? `${finding.net} measured ${Number(hit.value)} V vs nominal ${Number(
          hit.nominal_v,
        )} V`
      : 'a rail collapse needs a measured voltage well below nominal'
  } else {
    // Other kinds: require at least one measurement tied to the part or net.
    const hit = meas.find(
      (m) => m.comp_refdes === finding.refdes || m.net_name === finding.net,
    )
    chainConsistent = Boolean(hit)
    chainDetail = hit
      ? `measurement on record for ${hit.comp_refdes ?? hit.net_name}`
      : 'no measurement ties this finding to the part/net'
  }
  checks.push({
    id: 'chain',
    label: 'measurement → finding chain is consistent',
    pass: chainConsistent,
    detail: chainDetail,
  })

  // verifyCitations(): every cited refdes/net must resolve to a row.
  const citation = await verifyCitations(deviceId, citedRefs)
  checks.push(citation)

  const verified = checks.every((c) => c.pass)
  return { verified, checks }
}

export async function verifyCitations(
  deviceId: string,
  cited: { refdes: string[]; nets: string[] },
): Promise<VerificationCheck> {
  const bad: string[] = []
  for (const rd of cited.refdes) {
    const { rows } = await query(
      'SELECT 1 FROM components WHERE device_id = $1 AND refdes = $2',
      [deviceId, rd],
    )
    if (rows.length === 0) bad.push(rd)
  }
  for (const nt of cited.nets) {
    const { rows } = await query(
      'SELECT 1 FROM nets WHERE device_id = $1 AND name = $2',
      [deviceId, nt],
    )
    if (rows.length === 0) bad.push(nt)
  }
  return {
    id: 'citations',
    label: 'every cited refdes/net resolves to a row',
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? 'all citations resolve'
        : `unresolved citations: ${bad.join(', ')}`,
  }
}

export type { MeasurementInput }
