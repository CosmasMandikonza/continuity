'use server'

// Server-only read surfaces. lib/db.ts (the pg pool) is never imported by a
// client component -- it is reached only through these actions.
import { cache } from 'react'
import {
  provenanceCard,
  netCard,
  deviceIdByName,
  fleetSummary,
  readTenantUsage,
  getGraph,
  listRepairs,
  getRepairDetail,
  fleetBreakdown,
  type FleetSummary,
  type DeviceGraph,
  type RepairListItem,
  type RepairDetail,
  type FleetBreakdown,
} from '@/lib/queries'
import { withTenant } from '@/lib/db'
import { getTenantId } from '@/lib/tenant'

const DEVICE_NAME = 'MNT Reform'

// Shape consumed by the (pixel-identical) provenance card UI.
export interface ProvCardView {
  kind: 'comp' | 'net'
  rd: string
  src: string
  grid: [string, string][]
  conf: string
}

// Resolve the shared MNT Reform device id once per request.
const sharedDeviceId = cache(async () => deviceIdByName(DEVICE_NAME))

function fmtVolts(v: number | null): string {
  return v != null ? `${v.toFixed(2)} V` : '—'
}

// getProvenance(refdes) -> live derived card. `refdes` is the chip's prov key.
// Scripted chips use 'U7' | 'C29' | 'J15' (components) and 'PP5V0' (net alias).
// Live chips pass the raw token, which may be any component refdes or a full
// net name (e.g. 'PP5V0_SYS'). We resolve a component first, then fall back to
// a net lookup, so every chip resolves against the real board.
export async function getProvenance(refdes: string): Promise<ProvCardView | null> {
  const deviceId = await sharedDeviceId()
  if (!deviceId) return null

  // The scripted net alias maps to the named net PP5V0_SYS.
  const netAlias = refdes === 'PP5V0' ? 'PP5V0_SYS' : null

  // Component chips: try the component table first (unless it's the net alias).
  if (!netAlias) {
    const card = await provenanceCard(deviceId, refdes)
    if (card) {
      const primaryNet = card.nets[0]
      const grid: [string, string][] = [
        ['type', card.kind + (card.value ? ` · ${card.value}` : '')],
        ['value', card.value ?? '—'],
        ['package', card.package ?? '—'],
        ['net', primaryNet ? primaryNet.name : '—'],
        ['mpn', card.mpn ?? '—'],
      ]
      return {
        kind: 'comp',
        rd: card.refdes,
        src: card.sourceRef ?? 'electrical graph',
        grid,
        conf: card.confidence != null ? card.confidence.toFixed(2) : '—',
      }
    }
  }

  // Net chip (alias or live net token): resolve against the net table.
  const net = await netCard(deviceId, netAlias ?? refdes)
  if (net) {
    return {
      kind: 'net',
      rd: net.name,
      src: 'electrical graph',
      grid: [
        ['class', net.netClass ? `${net.netClass} rail` : 'net'],
        ['nominal', fmtVolts(net.nominalV)],
        ['members', `${net.pinCount} pins`],
        ['components', String(net.componentCount)],
        ['on net', net.source ?? '—'],
      ],
      conf: '0.97',
    }
  }

  return null
}

// getFailureRate -> the cross-shop fleet readout for the workbench panel.
export async function getFailureRate(
  deviceName = DEVICE_NAME,
  symptom = 'no power',
): Promise<FleetSummary | null> {
  return fleetSummary(deviceName, symptom)
}

// getMeterUsage -> the signed-in shop's real diagnostics count for the current
// month, powering the faceplate meter pill. Read-only (no increment).
export async function getMeterUsage(): Promise<{ used: number; quota: number }> {
  const tenantId = await getTenantId()
  const period = new Date().toISOString().slice(0, 7) // YYYY-MM
  return withTenant(tenantId, (client) => readTenantUsage(client, tenantId, period))
}

// getDeviceGraph -> the shared MNT Reform's full electrical graph for the
// Knowledge Graph view. Shared device, so no tenant scoping is needed.
export async function getDeviceGraph(deviceName = DEVICE_NAME): Promise<DeviceGraph | null> {
  const deviceId = await deviceIdByName(deviceName)
  if (!deviceId) return null
  return getGraph(deviceId)
}

// listRepairsAction -> the signed-in shop's repair history (RLS-scoped). A new
// shop with no diagnostics yet gets an empty list.
export async function listRepairsAction(): Promise<RepairListItem[]> {
  const tenantId = await getTenantId()
  return withTenant(tenantId, (client) => listRepairs(client, tenantId))
}

// getRepairDetailAction -> one repair's full record (RLS-scoped; only the owning
// shop can read it). Returns null for an id the current shop doesn't own.
export async function getRepairDetailAction(repairId: string): Promise<RepairDetail | null> {
  const tenantId = await getTenantId()
  return withTenant(tenantId, (client) => getRepairDetail(client, repairId))
}

// getFleetBreakdown -> the full cross-shop root-cause distribution for the Fleet
// view. Privacy-preserving aggregate; returns rates only, never tenant rows.
export async function getFleetBreakdown(
  deviceName = DEVICE_NAME,
  symptom = 'no power',
): Promise<FleetBreakdown | null> {
  return fleetBreakdown(deviceName, symptom)
}
