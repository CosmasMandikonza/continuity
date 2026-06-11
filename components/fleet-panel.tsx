'use client'

import { useEffect, useState } from 'react'
import { getFailureRate } from '@/app/actions'
import type { FleetSummary } from '@/lib/queries'

// Cross-shop fleet readout. The only surface that cannot exist without a
// database: it aggregates confirmed root causes across multiple tenants'
// repairs via a SECURITY DEFINER function and reports percentages only.
export function FleetPanel() {
  const [data, setData] = useState<FleetSummary | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    getFailureRate().then((d) => {
      if (!alive) return
      setData(d)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <section
      className="hidden min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055] md:flex"
      aria-label="Fleet insight"
    >
      <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
        <span className="ucl text-[10px] text-ink-2s">Fleet</span>
        <span className="ml-auto font-mono text-[9px] text-ink-3">CROSS-SHOP</span>
      </div>

      <div className="px-[12px] pb-[12px] pt-[9px]">
        {data ? (
          <>
            <div className="flex items-baseline gap-[6px]">
              <span className="font-mono text-[20px] font-bold leading-none tracking-[-0.02em] text-flux-ink">
                {data.refdes}
              </span>
              <span className="font-mono text-[20px] font-bold leading-none tracking-[-0.02em] text-ink-2s">
                {Math.round(data.pct)}%
              </span>
            </div>

            <div className="mt-[8px] font-mono text-[10px] leading-[1.5] text-ink-2s">
              confirmed root cause in{' '}
              <span className="font-semibold text-ink-1">{Math.round(data.pct)}%</span> of{' '}
              {data.symptom} repairs
            </div>

            {/* meter bar */}
            <div className="mt-[9px] h-[5px] overflow-hidden rounded-full bg-[#00000018]">
              <div
                className="h-full rounded-full bg-probe shadow-[0_0_8px_#ff5247]"
                style={{ width: `${Math.min(100, Math.round(data.pct))}%` }}
              />
            </div>

            <div className="mt-[11px] flex items-center justify-between border-t border-dashed border-rule pt-[9px] font-mono text-[9px] text-ink-3">
              <span>{data.totalRepairs} repairs</span>
              <span>{data.shops} shops</span>
            </div>

            <div className="mt-[8px] font-mono text-[8.5px] leading-[1.5] tracking-[0.02em] text-ink-3">
              AGGREGATE · ANONYMIZED
              <br />
              SECURITY DEFINER · NO ROW LEAK
            </div>
          </>
        ) : (
          <div className="py-[14px] font-mono text-[9px] tracking-[0.04em] text-ink-3">
            {loaded ? 'NO FLEET DATA' : 'QUERYING FLEET…'}
          </div>
        )}
      </div>
    </section>
  )
}
