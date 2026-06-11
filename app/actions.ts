'use server'

// Server-only read surfaces. lib/db.ts (the pg pool) is never imported by a
// client component -- it is reached only through these actions.
import { cache } from 'react'
import {
  provenanceCard,
  netCard,
  deviceIdByName,
  fleetSummary,
  type FleetSummary,
} from '@/lib/queries'

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

// getProvenance(refdes) -> live derived card. `refdes` is the chip's prov key
// ('U7' | 'C29' | 'J15' for components, 'PP5V0' for the net).
export async function getProvenance(refdes: string): Promise<ProvCardView | null> {
  const deviceId = await sharedDeviceId()
  if (!deviceId) return null

  // Net chip: 'PP5V0' is the demo alias for PP5V0_SYS; otherwise the live agent
  // cites a net by its real name. Build a net card from the named net row.
  const netName = refdes === 'PP5V0' ? 'PP5V0_SYS' : refdes
  const looksLikeNet = refdes === 'PP5V0' || /_|^(GND|VBUS|PP|VBAT|VDD|VCC)/i.test(refdes)
  if (looksLikeNet) {
    const net = await netCard(deviceId, netName)
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
  }

  // Component chips.
  const card = await provenanceCard(deviceId, refdes)
  if (!card) {
    // Last resort: maybe it's a net that didn't match the heuristic above.
    const net = await netCard(deviceId, refdes)
    if (!net) return null
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

// getFailureRate -> the cross-shop fleet readout for the workbench panel.
export async function getFailureRate(
  deviceName = DEVICE_NAME,
  symptom = 'no power',
): Promise<FleetSummary | null> {
  return fleetSummary(deviceName, symptom)
}
