'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PenLine, Camera, ArrowRight, RotateCcw } from 'lucide-react'
import type { ROWS, Step } from '@/lib/continuity-data'
import { ChipRow } from './chip-row'

interface DiagnosticConsoleProps {
  entries: Step[]
  thinking: boolean
  busy: boolean
  onReplay: () => void
  onOpen: (key: keyof typeof ROWS, rect: DOMRect) => void
  onClose: () => void
}

const tagClass: Record<string, string> = {
  user: 'text-ink-2s border-rule-2 bg-[#fff7e9]',
  trace: 'text-[#1f7a52] border-[#9fd9bf] bg-[#e9f7ef]',
  measure: 'text-[#9a6a00] border-[#e9cf94] bg-[#fbf2dc]',
  cause: 'text-flux-ink border-[#e6b99a] bg-[#fbe7da]',
  fix: 'text-flux border-[#e6b99a] bg-[#fbe7da]',
}

export function DiagnosticConsole({
  entries,
  thinking,
  busy,
  onReplay,
  onOpen,
  onClose,
}: DiagnosticConsoleProps) {
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [entries, thinking])

  return (
    <section
      className="flex min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055]"
      aria-label="Diagnostic console"
    >
      <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
        <span className="ucl text-[10px] text-ink-2s">Diagnostic</span>
        <span className="font-mono text-[9px] text-ink-3">#R-2241</span>
        <span className="ml-auto flex items-center gap-[6px] font-mono text-[9px] text-ink-3">
          <span
            className={`h-[6px] w-[6px] rounded-full ${
              busy
                ? 'animate-pulse-dot bg-phos shadow-[0_0_8px_#39f0a3]'
                : 'bg-[#c9c0ad]'
            }`}
          />
          {busy ? 'piloting board' : entries.length ? 'done' : 'idle'}
        </span>
      </div>

      <div
        ref={logRef}
        className="log-scroll flex flex-col gap-[13px] overflow-auto px-[14px] pb-2 pt-[13px]"
      >
        <AnimatePresence initial={false}>
          {entries.map((s, idx) => (
            <motion.div
              key={`${s.label}-${s.when}-${idx}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
            >
              <div className="mb-[5px] flex items-center gap-2">
                <span
                  className={`rounded-[4px] border px-[6px] py-[2px] font-mono text-[8.5px] uppercase leading-none tracking-[0.14em] ${tagClass[s.k]}`}
                >
                  {s.label}
                </span>
                <span className="ml-auto font-mono text-[8.5px] text-ink-3">
                  {s.when}
                </span>
              </div>
              <div
                className={`text-[13px] leading-[1.55] ${
                  s.k === 'user' ? 'text-ink-2s' : 'text-ink'
                }`}
              >
                <ChipRow segments={s.content} onOpen={onOpen} onClose={onClose} />
              </div>
              {s.fix && s.fixSteps && (
                <FixCard steps={s.fixSteps} onOpen={onOpen} onClose={onClose} />
              )}
            </motion.div>
          ))}

          {thinking && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-[5px] flex items-center gap-2">
                <span className="rounded-[4px] border border-[#9fd9bf] bg-[#e9f7ef] px-[6px] py-[2px] font-mono text-[8.5px] leading-none tracking-[0.14em] text-[#1f7a52]">
                  ···
                </span>
              </div>
              <div className="font-mono text-[11px] text-ink-3">
                querying electrical_graph…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* composer */}
      <div className="border-t border-rule p-[11px]">
        <div className="flex items-center gap-[9px] rounded-[9px] border border-rule-2 bg-[#fff7e9] px-[11px] py-[9px] focus-within:border-flux focus-within:shadow-[0_0_0_3px_#e2540a22]">
          <button
            type="button"
            className="text-ink-3 transition-colors hover:text-flux"
            title="Capture from microscope"
            aria-label="Capture frame"
          >
            <Camera size={17} strokeWidth={1.6} />
          </button>
          <input
            placeholder="Ask about a refdes, net, or measurement…"
            aria-label="Message"
            className="flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
          <button
            type="button"
            className="grid h-[30px] w-[30px] place-items-center rounded-[7px] bg-flux text-primary-foreground transition-colors hover:bg-flux-2"
            aria-label="Send"
          >
            <ArrowRight size={15} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-ink-3">
          <span>
            every refdes{' '}
            <span className="text-[#1f7a52]">verified against the board</span>
          </span>
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-1 font-mono text-[9.5px] text-flux"
          >
            <RotateCcw size={11} strokeWidth={2} /> replay
          </button>
        </div>
      </div>
    </section>
  )
}

function FixCard({
  steps,
  onOpen,
  onClose,
}: {
  steps: import('@/lib/continuity-data').Segment[][]
  onOpen: (key: keyof typeof ROWS, rect: DOMRect) => void
  onClose: () => void
}) {
  return (
    <div className="mt-[10px] rounded-[9px] border border-[#e6a273] bg-[linear-gradient(180deg,#fbe7da,#fbeee6)] px-3 py-[11px]">
      <div className="mb-2 flex items-center gap-[7px] font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-flux">
        <PenLine size={13} strokeWidth={1.8} />
        repair protocol · 3 steps
      </div>
      <ol className="m-0 list-decimal pl-[18px] text-[12.5px] leading-[1.65] text-ink">
        {steps.map((seg, i) => (
          <li key={i}>
            <ChipRow segments={seg} onOpen={onOpen} onClose={onClose} />
          </li>
        ))}
      </ol>
    </div>
  )
}
