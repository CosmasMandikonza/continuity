'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PenLine, Camera, ArrowRight, RotateCcw, ShieldCheck, ShieldAlert, X } from 'lucide-react'
import type { ROWS, Step } from '@/lib/continuity-data'
import type { VerificationView } from './use-diagnostic-sequence'
import { ChipRow } from './chip-row'

interface DiagnosticConsoleProps {
  entries: Step[]
  thinking: boolean
  busy: boolean
  notice: { kind: 'quota' | 'throttle' | 'error'; text: string } | null
  verification: VerificationView | null
  onReplay: () => void
  onSubmit: (symptom: string, image?: string) => void
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
  notice,
  verification,
  onReplay,
  onSubmit,
  onOpen,
  onClose,
}: DiagnosticConsoleProps) {
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [image, setImage] = useState<string | null>(null)

  // Read a board photo, downscale it (so a phone shot stays well under Vercel's
  // request limit), and keep it as a data URL until the next diagnose call.
  const onPickImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      const img = new Image()
      img.onload = () => {
        const max = 1024
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return setImage(src)
        ctx.drawImage(img, 0, 0, w, h)
        setImage(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => setImage(src)
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [entries, thinking, verification, notice])

  const submit = () => {
    const symptom = draft.trim()
    if ((!symptom && !image) || busy) return
    onSubmit(symptom || 'Diagnose from the attached board photo.', image ?? undefined)
    setDraft('')
    setImage(null)
  }

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

          {verification && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
            >
              <VerificationStamp v={verification} />
            </motion.div>
          )}

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
        {notice && (
          <div
            className={`mb-[9px] rounded-[8px] border px-[11px] py-[8px] font-mono text-[10px] leading-[1.5] ${
              notice.kind === 'quota'
                ? 'border-[#e9cf94] bg-[#fbf2dc] text-[#9a6a00]'
                : 'border-[#e6a273] bg-[#fbe7da] text-flux'
            }`}
            role="status"
          >
            {notice.text}
          </div>
        )}
        {image && (
          <div className="mb-[9px] flex items-center gap-[9px] rounded-[8px] border border-rule-2 bg-[#fff7e9] px-[9px] py-[7px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="attached board" className="h-9 w-9 rounded-[5px] border border-rule object-cover" />
            <span className="font-mono text-[10px] text-ink-2s">board photo attached</span>
            <button
              type="button"
              onClick={() => setImage(null)}
              className="ml-auto text-ink-3 transition-colors hover:text-flux"
              aria-label="Remove photo"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-[9px] rounded-[9px] border border-rule-2 bg-[#fff7e9] px-[11px] py-[9px] focus-within:border-flux focus-within:shadow-[0_0_0_3px_#e2540a22]">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className={`transition-colors disabled:opacity-40 ${
              image ? 'text-flux' : 'text-ink-3 hover:text-flux'
            }`}
            title="Attach a photo of the board"
            aria-label="Attach board photo"
          >
            <Camera size={17} strokeWidth={1.6} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickImage}
            className="hidden"
            aria-hidden
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            disabled={busy}
            placeholder="Describe a symptom to diagnose live…"
            aria-label="Message"
            className="flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || (!draft.trim() && !image)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[7px] bg-flux text-primary-foreground transition-colors hover:bg-flux-2 disabled:opacity-40"
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

function VerificationStamp({ v }: { v: VerificationView }) {
  const ok = v.verified
  return (
    <div
      className={`rounded-[9px] border px-3 py-[10px] ${
        ok ? 'border-[#9fd9bf] bg-[#e9f7ef]' : 'border-[#e9cf94] bg-[#fbf2dc]'
      }`}
    >
      <div
        className={`flex items-center gap-[7px] font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${
          ok ? 'text-[#1f7a52]' : 'text-[#9a6a00]'
        }`}
      >
        {ok ? <ShieldCheck size={14} strokeWidth={2} /> : <ShieldAlert size={14} strokeWidth={2} />}
        {ok ? 'verified \u2713 against electrical_graph' : '\u26a0 unverified \u2014 needs review'}
        <span className="ml-auto font-mono text-[9px] font-normal text-ink-3">{v.refdes}</span>
      </div>
      {v.checks.length > 0 && (
        <ul className="mt-[8px] flex flex-col gap-[4px]">
          {v.checks.map((c, i) => (
            <li key={i} className="flex items-center gap-[6px] font-mono text-[10px] text-ink-2s">
              <span className={c.pass ? 'text-[#1f7a52]' : 'text-flux'}>
                {c.pass ? '\u2713' : '\u2715'}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
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
        repair protocol · {steps.length} steps
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
