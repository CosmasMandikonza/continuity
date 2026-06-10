'use client'

import { useEffect, useRef, useState } from 'react'

interface MeasureGaugeProps {
  target: number | null
}

const FROM = 5.0
const DURATION = 750

export function MeasureGauge({ target }: MeasureGaugeProps) {
  const [value, setValue] = useState(0)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (target === null) {
      setValue(0)
      return
    }
    // settle from 5.00 down to the measured value with an ease-in-out curve
    let t0: number | null = null
    const tick = (ts: number) => {
      if (t0 === null) t0 = ts
      const p = Math.min(1, (ts - t0) / DURATION)
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      setValue(FROM + (target - FROM) * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [target])

  const active = target !== null
  const pct = active ? (target / 5) * 100 : 0

  return (
    <section className="flex flex-none flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055]">
      <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
        <span className="ucl text-[10px] text-ink-2s">Measure</span>
        <span className="ml-auto font-mono text-[9px] text-ink-3">DCV · AUTO</span>
      </div>
      <div className="px-[15px] pb-[15px] pt-[13px]">
        <div className="mb-[9px] flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-ink-2s">PP5V0_SYS</span>
          <span
            className="rounded-[4px] border border-[#e6a273] px-[6px] py-[2px] font-mono text-[8px] uppercase tracking-[0.13em] text-flux transition-opacity duration-300"
            style={{ opacity: active ? 1 : 0 }}
          >
            RAIL COLLAPSE
          </span>
        </div>
        <div className="flex items-baseline gap-[9px]">
          <span
            className={`font-mono text-[40px] font-semibold leading-[0.9] tracking-[-0.02em] tabular-nums ${
              active ? 'text-flux' : 'text-ink'
            }`}
          >
            {value.toFixed(2)}
          </span>
          <span className="font-mono text-[14px] text-ink-3">V</span>
          <span className="ml-auto font-mono text-[10.5px] text-ink-3">exp&nbsp;5.00&nbsp;V</span>
        </div>
        <div className="mt-[11px] h-[6px] overflow-hidden rounded-[4px] border border-rule bg-[#d8d1c0]">
          <div
            className="h-full rounded-[4px] bg-[linear-gradient(90deg,var(--flux),var(--caution))] transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-[5px] flex justify-between font-mono text-[8px] text-ink-3">
          <span>0</span>
          <span>1.25</span>
          <span>2.5</span>
          <span>3.75</span>
          <span>5 V</span>
        </div>
      </div>
    </section>
  )
}
