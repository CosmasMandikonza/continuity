'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ROWS } from '@/lib/continuity-data'
import { getProvenance, type ProvCardView } from '@/app/actions'

interface ProvState {
  view: ProvCardView
  left: number
  top: number
}

interface ProvenanceContextValue {
  open: (key: keyof typeof ROWS, rect: DOMRect) => void
  close: () => void
}

// Cache derived cards per prov key so repeated hovers are instant and we never
// flash an empty card.
const cardCache = new Map<string, ProvCardView>()

export function useProvenance(onLit?: (compId: string | null) => void) {
  const [prov, setProv] = useState<ProvState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against a stale fetch resolving after the pointer has moved away.
  const activeKey = useRef<string | null>(null)

  const open = useCallback(
    (key: keyof typeof ROWS, rect: DOMRect) => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      activeKey.current = key as string
      const left = Math.min(window.innerWidth - 256, Math.max(10, rect.left - 110))
      const top = rect.bottom + 8
      if (key !== 'PP5V0') onLit?.('c_' + key)

      const cached = cardCache.get(key as string)
      if (cached) {
        setProv({ view: cached, left, top })
        return
      }

      getProvenance(key as string).then((view) => {
        if (!view) return
        cardCache.set(key as string, view)
        // Only show if this key is still the one being hovered.
        if (activeKey.current === (key as string)) {
          setProv({ view, left, top })
        }
      })
    },
    [onLit],
  )

  const close = useCallback(() => {
    activeKey.current = null
    hideTimer.current = setTimeout(() => {
      setProv(null)
      onLit?.(null)
    }, 120)
  }, [onLit])

  const card = (
    <AnimatePresence>
      {prov && (
        <motion.div
          role="tooltip"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.16 }}
          style={{ left: prov.left, top: prov.top }}
          className="fixed z-[60] w-[244px] rounded-[9px] border border-rule-strong bg-[linear-gradient(180deg,#fbf6ea,#f3eddf)] p-[12px_13px] shadow-[0_1px_0_#fff_inset,0_22px_44px_-16px_#00000055]"
        >
          <ProvenanceBody view={prov.view} />
        </motion.div>
      )}
    </AnimatePresence>
  )

  return { open, close, card }
}

function ProvenanceBody({ view: r }: { view: ProvCardView }) {
  const isNet = r.kind === 'net'
  return (
    <>
      <div className="mb-[9px] flex items-center justify-between border-b border-rule pb-2">
        <span
          className="font-mono text-[13px] font-semibold"
          style={{ color: isNet ? '#1f7a52' : '#1162a8' }}
        >
          {r.rd}
        </span>
        <span className="rounded-[4px] border border-rule-2 px-[5px] py-[2px] font-mono text-[8px] uppercase tracking-[0.06em] text-ink-3">
          {r.src}
        </span>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[6px] text-[11.5px]">
        {r.grid.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-ink-3">{k}</div>
            <div className="text-right font-mono text-ink-2s">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-[10px] flex justify-between border-t border-rule pt-2 font-mono text-[8.5px] text-ink-3">
        <span>row · electrical_graph</span>
        <span className="font-semibold text-[#1f7a52]">✓ verified · {r.conf}</span>
      </div>
    </>
  )
}

export type { ProvenanceContextValue }
