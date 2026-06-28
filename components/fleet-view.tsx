'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { FleetBreakdown } from '@/lib/queries'

export function FleetView({
  breakdown,
  deviceName,
}: {
  breakdown: FleetBreakdown | null
  deviceName: string
}) {
  const reduce = useReducedMotion()
  const rows = breakdown?.rows ?? []
  const top = rows[0] ?? null

  return (
    <div className="grid min-h-0 gap-[14px] p-[14px] md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_330px]">
      {/* ── breakdown (left) ─────────────────────────────────── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055]">
        <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
          <span className="ucl text-[10px] text-ink-2s">Fleet insights</span>
          <span className="ml-auto font-mono text-[9px] text-ink-3">
            CROSS-SHOP · {deviceName.toUpperCase()}
          </span>
        </div>

        {!breakdown || rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center font-mono text-[10px] tracking-[0.06em] text-ink-3">
            NO FLEET DATA
          </div>
        ) : (
          <div className="log-scroll min-h-0 flex-1 overflow-y-auto px-[16px] py-[15px]">
            {/* headline cause */}
            {top && (
              <div className="rounded-[11px] border border-rule-2 bg-[#fff7e9] p-[15px]">
                <div className="ucl text-[9px] text-ink-3">Most common root cause</div>
                <div className="mt-[8px] flex items-end gap-[12px]">
                  <span className="font-display text-[44px] font-bold leading-[0.85] tracking-[-0.03em] text-flux-ink">
                    {top.refdes}
                  </span>
                  <span className="font-display text-[44px] font-bold leading-[0.85] tracking-[-0.03em] text-probe">
                    {Math.round(top.pct)}%
                  </span>
                </div>
                <p className="mt-[10px] font-sans text-[12.5px] leading-[1.5] text-ink-2s">
                  Confirmed root cause in{' '}
                  <b className="font-semibold text-ink">
                    {top.rootCauses} of {top.totalRepairs}
                  </b>{' '}
                  &ldquo;{breakdown.symptom}&rdquo; repairs across{' '}
                  <b className="font-semibold text-ink">{breakdown.shops} shops</b>. Stock it before
                  the customer calls.
                </p>
              </div>
            )}

            {/* distribution */}
            <div className="ucl mt-[18px] text-[9px] text-ink-3">Root-cause distribution</div>
            <div className="mt-[10px] flex flex-col gap-[12px]">
              {rows.map((r, i) => {
                const pct = Math.round(r.pct)
                const isTop = i === 0
                return (
                  <div key={r.componentId} className="flex flex-col gap-[5px]">
                    <div className="flex items-baseline gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-ink">{r.refdes}</span>
                      <span className="text-ink-3">{r.kind}</span>
                      <span className="ml-auto tabular-nums text-ink-2s">{pct}%</span>
                      <span className="w-[58px] text-right tabular-nums text-[9px] text-ink-3">
                        {r.rootCauses}/{r.totalRepairs}
                      </span>
                    </div>
                    <div className="h-[8px] overflow-hidden rounded-full bg-[#00000014]">
                      <motion.div
                        className={`h-full rounded-full ${
                          isTop
                            ? 'bg-probe shadow-[0_0_8px_#ff5247]'
                            : 'bg-flux shadow-[0_0_7px_var(--flux)]'
                        }`}
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.7, delay: 0.05 * i, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── how it's computed (right) ─────────────────────────── */}
      <aside className="flex min-h-0 flex-col gap-[12px] overflow-y-auto">
        <div className="grid grid-cols-2 overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset]">
          <Stat k={breakdown ? String(breakdown.shops) : '—'} v="shops contributing" />
          <Stat k={breakdown ? String(breakdown.totalRepairs) : '—'} v="confirmed repairs" border />
        </div>

        <div className="rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[14px] shadow-[0_1px_0_#fff8ec_inset]">
          <div className="ucl text-[10px] text-ink-2s">How this is computed</div>
          <p className="mt-[8px] font-sans text-[11.5px] leading-[1.55] text-ink-2s">
            A <span className="font-mono text-[10.5px] text-flux-ink">SECURITY&nbsp;DEFINER</span>{' '}
            aggregate reads every shop&rsquo;s confirmed repairs and returns only these percentages.
          </p>
          <p className="mt-[9px] font-sans text-[11.5px] leading-[1.55] text-ink-2s">
            No shop ever sees another shop&rsquo;s parts, customers, or boards: every read is
            scoped to one shop, with row-level security policies as a second guardrail. Only this{' '}
            <i>aggregate</i> crosses that boundary — and only as counts. The rows never do.
          </p>
          <div className="mt-[12px] flex flex-wrap gap-[6px] font-mono text-[8.5px] uppercase tracking-[0.08em] text-ink-3">
            <Tag>aggregate</Tag>
            <Tag>anonymized</Tag>
            <Tag>no row leak</Tag>
            <Tag>tenant-scoped</Tag>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Stat({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <div className={`px-[14px] py-[13px] ${border ? 'border-l border-rule' : ''}`}>
      <div className="font-display text-[24px] font-bold leading-none tracking-[-0.02em] text-flux-ink">
        {k}
      </div>
      <div className="mt-[6px] font-mono text-[9px] leading-[1.4] text-ink-3">{v}</div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[4px] bg-[#0000000d] px-[6px] py-[2px] text-ink-3">{children}</span>
  )
}
