'use client'

import { useEffect, useMemo, useState } from 'react'
import { getProvenance, type ProvCardView } from '@/app/actions'
import type { DeviceGraph } from '@/lib/queries'

// ── node-link model ──────────────────────────────────────────────────────
interface GNode {
  id: string
  kind: 'comp' | 'net'
  label: string
  token: string // what we pass to getProvenance (refdes or net name)
  sub: string | null
}
interface GLink {
  source: string
  target: string
}

const W = 760
const H = 560
const PAD = 56

// Deterministic force-directed layout. Runs once per graph in a useMemo — the
// database returns no coordinates, so the client computes them. Small graphs
// (a board is tens of nodes), so an O(n^2) relaxation is instant.
function computeLayout(nodes: GNode[], links: GLink[]) {
  const n = nodes.length
  const cx = W / 2
  const cy = H / 2
  const ring = Math.min(W, H) * 0.34
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]))
  const pos = nodes.map((_, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, n)
    // tiny index-based offset so no two nodes ever start exactly coincident
    return { x: cx + ring * Math.cos(a) + (i % 3), y: cy + ring * Math.sin(a) + (i % 2) }
  })

  const REST = 96
  const K_REPEL = 11000
  const K_SPRING = 0.05
  const K_CENTER = 0.018
  const STEP = 0.85
  const ITERS = 340

  for (let it = 0; it < ITERS; it++) {
    const cool = 1 - it / ITERS
    const dx = new Array(n).fill(0)
    const dy = new Array(n).fill(0)

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ax = pos[i].x - pos[j].x
        let ay = pos[i].y - pos[j].y
        let d2 = ax * ax + ay * ay
        if (d2 < 0.01) {
          d2 = 0.01
          ax = 0.1
          ay = 0.1
        }
        const dist = Math.sqrt(d2)
        const f = K_REPEL / d2
        const ux = ax / dist
        const uy = ay / dist
        dx[i] += ux * f
        dy[i] += uy * f
        dx[j] -= ux * f
        dy[j] -= uy * f
      }
    }

    for (const l of links) {
      const a = idx.get(l.source)
      const b = idx.get(l.target)
      if (a == null || b == null) continue
      const ax = pos[b].x - pos[a].x
      const ay = pos[b].y - pos[a].y
      const dist = Math.sqrt(ax * ax + ay * ay) || 0.01
      const f = (dist - REST) * K_SPRING
      const ux = ax / dist
      const uy = ay / dist
      dx[a] += ux * f
      dy[a] += uy * f
      dx[b] -= ux * f
      dy[b] -= uy * f
    }

    for (let i = 0; i < n; i++) {
      dx[i] += (cx - pos[i].x) * K_CENTER
      dy[i] += (cy - pos[i].y) * K_CENTER
      pos[i].x += dx[i] * STEP * cool
      pos[i].y += dy[i] * STEP * cool
      pos[i].x = Math.max(PAD, Math.min(W - PAD, pos[i].x))
      pos[i].y = Math.max(PAD, Math.min(H - PAD, pos[i].y))
    }
  }
  return pos
}

export function GraphView({
  graph,
  deviceName,
}: {
  graph: DeviceGraph | null
  deviceName: string
}) {
  const [selected, setSelected] = useState<GNode | null>(null)
  const [card, setCard] = useState<ProvCardView | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  const { nodes, links } = useMemo(() => {
    if (!graph) return { nodes: [] as GNode[], links: [] as GLink[] }
    const nodes: GNode[] = [
      ...graph.components.map((c) => ({
        id: `c:${c.refdes}`,
        kind: 'comp' as const,
        label: c.refdes,
        token: c.refdes,
        sub: c.value ?? c.kind,
      })),
      ...graph.nets.map((nt) => ({
        id: `n:${nt.name}`,
        kind: 'net' as const,
        label: nt.name,
        token: nt.name,
        sub: nt.nominalV != null ? `${nt.nominalV.toFixed(2)} V` : (nt.netClass ?? 'net'),
      })),
    ]
    const present = new Set(nodes.map((x) => x.id))
    const links: GLink[] = graph.links
      .map((l) => ({ source: `c:${l.comp}`, target: `n:${l.net}` }))
      .filter((l) => present.has(l.source) && present.has(l.target))
    return { nodes, links }
  }, [graph])

  const pos = useMemo(() => computeLayout(nodes, links), [nodes, links])
  const posById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    nodes.forEach((nd, i) => m.set(nd.id, pos[i]))
    return m
  }, [nodes, pos])

  function selectNode(node: GNode) {
    setSelected(node)
    setCard(null)
    setLoading(true)
    getProvenance(node.token).then((view) => {
      setCard(view)
      setLoading(false)
    })
  }

  return (
    <div className="grid min-h-0 gap-[14px] p-[14px] md:grid-cols-[minmax(0,1fr)_298px] lg:grid-cols-[minmax(0,1fr)_330px]">
      {/* ── the phosphor screen ─────────────────────────────── */}
      <section className="relative flex min-h-0 flex-col overflow-hidden rounded-[12px] border border-[#04130f] bg-[radial-gradient(130%_110%_at_50%_-10%,#10150f,#0b0e0c_58%,#070a08)] shadow-[0_0_0_1px_#1b2a23_inset,0_28px_60px_-34px_#000_inset,0_18px_40px_-30px_#00000088]">
        {/* faint phosphor dot-grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage: 'radial-gradient(circle, #16271f 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* screen header */}
        <div className="relative flex items-center gap-2 border-b border-[#152a22] px-3 py-[8px]">
          <span className="h-[6px] w-[6px] rounded-full bg-phos shadow-[0_0_7px_#39f0a3]" />
          <span className="font-mono text-[9.5px] tracking-[0.06em] text-phos/80">
            electrical_graph · {deviceName}
          </span>
          <span className="ml-auto font-mono text-[8.5px] tracking-[0.08em] text-comp/60">
            rendered live from Aurora
          </span>
        </div>

        {!graph || nodes.length === 0 ? (
          <div className="relative flex flex-1 items-center justify-center font-mono text-[10px] tracking-[0.06em] text-phos/50">
            NO GRAPH DATA
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="relative min-h-0 flex-1"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease' }}
            role="img"
            aria-label={`Electrical graph of ${deviceName}`}
          >
            {/* links */}
            <g stroke="#2f7d63" strokeWidth={1.1} opacity={0.55}>
              {links.map((l, i) => {
                const a = posById.get(l.source)
                const b = posById.get(l.target)
                if (!a || !b) return null
                const hot = selected && (l.source === selected.id || l.target === selected.id)
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={hot ? '#39f0a3' : '#2f7d63'}
                    strokeWidth={hot ? 1.8 : 1.1}
                    opacity={selected && !hot ? 0.28 : 0.6}
                  />
                )
              })}
            </g>

            {/* nodes */}
            {nodes.map((nd, i) => {
              const p = pos[i]
              const isNet = nd.kind === 'net'
              const r = isNet ? 9 : 6.5
              const color = isNet ? '#39f0a3' : '#86d9ff'
              const isSel = selected?.id === nd.id
              const dim = selected && !isSel
              return (
                <g
                  key={nd.id}
                  transform={`translate(${p.x} ${p.y})`}
                  onClick={() => selectNode(nd)}
                  style={{ cursor: 'pointer' }}
                  opacity={dim ? 0.45 : 1}
                >
                  {isSel && (
                    <circle r={r + 6} fill="none" stroke={color} strokeWidth={1} opacity={0.5} />
                  )}
                  <circle
                    r={r}
                    fill="#0b0e0c"
                    stroke={color}
                    strokeWidth={isSel ? 2.2 : 1.5}
                    style={{ filter: isSel ? `drop-shadow(0 0 6px ${color})` : 'none' }}
                  />
                  <text
                    y={r + 12}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize={isNet ? 9.5 : 9}
                    fill={color}
                    stroke="#070a08"
                    strokeWidth={2.6}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none' }}
                  >
                    {nd.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </section>

      {/* ── inspector (light chassis) ───────────────────────── */}
      <aside className="flex min-h-0 flex-col gap-[12px] overflow-y-auto">
        <div className="rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[12px] shadow-[0_1px_0_#fff8ec_inset]">
          <div className="ucl text-[10px] text-ink-2s">Knowledge graph</div>
          <p className="mt-[6px] font-sans text-[11px] leading-[1.5] text-ink-3">
            Every node is a real row. Tap one to see the same derived card the agent reads when it
            cites that part.
          </p>
          <div className="mt-[10px] flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-2s">
            <span className="flex items-center gap-[6px]">
              <span className="h-[8px] w-[8px] rounded-full border-[1.5px] border-[#3aa6cf] bg-[#0b0e0c]" />
              {graph?.components.length ?? 0} components
            </span>
            <span className="flex items-center gap-[6px]">
              <span className="h-[8px] w-[8px] rounded-full border-[1.5px] border-[#1f7a52] bg-[#0b0e0c]" />
              {graph?.nets.length ?? 0} nets
            </span>
            <span className="text-ink-3">{links.length} connections</span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[12px] shadow-[0_1px_0_#fff8ec_inset]">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <span className="ucl text-[10px] text-ink-2s">Inspect a row</span>
              <span className="font-mono text-[10px] text-ink-3">Tap any node in the graph.</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[16px] font-bold leading-none text-ink">
                  {selected.label}
                </span>
                <span
                  className={`rounded-[4px] px-[6px] py-[1px] font-mono text-[8px] uppercase tracking-[0.1em] ${
                    selected.kind === 'net'
                      ? 'bg-[#1f7a52]/12 text-[#1f7a52]'
                      : 'bg-[#3aa6cf]/15 text-[#2c7fa0]'
                  }`}
                >
                  {selected.kind === 'net' ? 'net' : 'component'}
                </span>
              </div>

              {loading && !card ? (
                <div className="mt-3 font-mono text-[10px] text-ink-3">resolving row…</div>
              ) : card ? (
                <>
                  <div className="mt-[10px] overflow-hidden rounded-[8px] border border-rule">
                    {card.grid.map(([k, v], i) => (
                      <div
                        key={k}
                        className={`flex items-center gap-3 px-[10px] py-[6px] ${
                          i > 0 ? 'border-t border-rule' : ''
                        }`}
                      >
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
                          {k}
                        </span>
                        <span className="ml-auto font-mono text-[10.5px] text-ink-2s">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-[10px] flex items-center justify-between font-mono text-[9px] text-ink-3">
                    <span>src · {card.src}</span>
                    <span>conf {card.conf}</span>
                  </div>
                </>
              ) : (
                <div className="mt-3 font-mono text-[10px] text-ink-3">No row resolved.</div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
