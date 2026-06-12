'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STEPS, type Step, type StepKind } from '@/lib/continuity-data'
import { parseSSEStream, phaseFromText, segmentize, nowLabel } from '@/lib/live-stream'

export interface VerificationView {
  refdes: string
  verified: boolean
  checks: { label: string; pass: boolean }[]
}

export interface InstrumentState {
  entries: Step[]
  thinking: boolean
  busy: boolean
  lit: Set<string>
  fault: Set<string>
  callouts: Set<string>
  traceDrawn: boolean
  meterTarget: number | null
  faultLed: boolean
  cursorV: string
  // live-mode additions (scripted runs leave these at their defaults)
  live: boolean
  notice: { kind: 'quota' | 'throttle' | 'error'; text: string } | null
  verification: VerificationView | null
  meterUsage: { used: number; quota: number } | null
}

const initialState: InstrumentState = {
  entries: [],
  thinking: false,
  busy: false,
  lit: new Set(),
  fault: new Set(),
  callouts: new Set(),
  traceDrawn: false,
  meterTarget: null,
  faultLed: false,
  cursorV: '—',
  live: false,
  notice: null,
  verification: null,
  meterUsage: null,
}

// Board elements that actually exist in the SVG; only these can light up.
const BOARD_ELEMENTS = new Set(['U7', 'C29', 'J15'])
const elId = (refdes: string) => `c_${refdes}`

export function useDiagnosticSequence() {
  const [state, setState] = useState<InstrumentState>(initialState)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const applyStep = useCallback((step: Step) => {
    setState((prev) => {
      const next: InstrumentState = {
        ...prev,
        entries: [...prev.entries, step],
        thinking: false,
        lit: new Set(prev.lit),
        fault: new Set(prev.fault),
        callouts: new Set(prev.callouts),
      }
      const fx = step.effects
      if (fx) {
        if (fx.busy !== undefined) next.busy = fx.busy
        fx.lit?.forEach((id) => next.lit.add(id))
        fx.fault?.forEach((id) => {
          next.lit.delete(id)
          next.fault.add(id)
        })
        fx.callouts?.forEach((id) => next.callouts.add(id))
        if (fx.drawTrace) next.traceDrawn = true
        if (fx.meter !== undefined) next.meterTarget = fx.meter
        if (fx.faultLed) next.faultLed = true
        if (fx.cursorV) next.cursorV = fx.cursorV
      }
      return next
    })
  }, [])

  const run = useCallback(() => {
    clearTimers()
    let t = 0
    STEPS.forEach((step) => {
      t += step.delay
      if (step.think) {
        timers.current.push(
          setTimeout(() => {
            setState((p) => ({ ...p, busy: true, thinking: true }))
          }, t),
        )
        t += step.think
        timers.current.push(setTimeout(() => applyStep(step), t))
      } else {
        timers.current.push(setTimeout(() => applyStep(step), t))
      }
    })
    timers.current.push(
      setTimeout(() => setState((p) => ({ ...p, busy: false })), t + 400),
    )
  }, [applyStep, clearTimers])

  const reset = useCallback(() => {
    clearTimers()
    abortRef.current?.abort()
    setState({
      ...initialState,
      lit: new Set(),
      fault: new Set(),
      callouts: new Set(),
    })
  }, [clearTimers])

  const replay = useCallback(() => {
    reset()
    const id = setTimeout(() => run(), 30)
    timers.current.push(id)
  }, [reset, run])

  // --- live console helpers --------------------------------------------------
  // Append a model-derived console entry, coalescing consecutive deltas of the
  // same phase into one growing entry (so streaming text doesn't spam the log).
  const liveBuf = useRef<{ kind: StepKind; label: string; text: string; raw: string } | null>(null)
  const knownNets = useRef<Set<string>>(new Set())
  const liveErrored = useRef(false)
  // Count of real (non-tech) entries produced this live run, so we know whether
  // a mid-stream error left us with usable output or a dead end.
  const liveOutputCount = useRef(0)

  const flushLiveEntry = useCallback(() => {
    const buf = liveBuf.current
    if (!buf || !buf.text.trim()) return
    const step: Step = {
      k: buf.kind,
      label: buf.label,
      when: nowLabel(),
      delay: 0,
      content: segmentize(buf.text.trim(), knownNets.current),
    }
    applyStep(step)
    liveBuf.current = null
    liveOutputCount.current += 1
  }, [applyStep])

  const pushUserEntry = useCallback(
    (symptom: string) => {
      applyStep({
        k: 'user',
        label: 'TECH',
        when: nowLabel(),
        delay: 0,
        content: [{ t: 'text', text: symptom }],
      })
    },
    [applyStep],
  )

  const handleChunk = useCallback(
    (chunk: { type: string; delta?: string; data?: Record<string, unknown>; errorText?: string }) => {
      const { type } = chunk
      // A mid-stream error (e.g. model/billing failure): mark for fallback.
      if (type === 'error') {
        liveErrored.current = true
        return
      }
      // Streaming assistant text.
      if (type === 'text-delta' && chunk.delta) {
        // Accumulate the RAW text (tags intact) so the phase label — taken from
        // the first tag — stays stable as more deltas arrive. The displayed body
        // is the tag-stripped version. Entries are separated on finish-step (one
        // per tool round-trip), so there's no fragile mid-stream splitting here.
        const raw = (liveBuf.current?.raw ?? '') + chunk.delta
        const seg = phaseFromText(raw)
        liveBuf.current = { kind: seg.kind, label: seg.label, text: seg.body, raw }
        setState((p) => ({ ...p, thinking: false }))
        return
      }
      if (type === 'text-end' || type === 'finish-step') {
        flushLiveEntry()
        return
      }

      const data = chunk.data ?? {}
      switch (type) {
        case 'data-meter-usage':
          setState((p) => ({
            ...p,
            meterUsage: { used: Number(data.used), quota: Number(data.quota) },
          }))
          break
        case 'data-quota':
          setState((p) => ({
            ...p,
            busy: false,
            thinking: false,
            notice: {
              kind: 'quota',
              text: `Monthly diagnostics used (${data.used}/${data.quota}) — resets next month`,
            },
            meterUsage: { used: Number(data.used), quota: Number(data.quota) },
          }))
          break
        case 'data-throttle':
          setState((p) => ({
            ...p,
            notice: { kind: 'throttle', text: 'Too many requests — try again in a moment' },
          }))
          break
        case 'data-trace': {
          const start = String(data.start ?? '')
          const nodes = (data.nodes as { refdes: string; viaNet?: string }[]) ?? []
          nodes.forEach((n) => n.viaNet && knownNets.current.add(n.viaNet))
          setState((p) => {
            const lit = new Set(p.lit)
            if (BOARD_ELEMENTS.has(start)) lit.add(elId(start))
            nodes.forEach((n) => BOARD_ELEMENTS.has(n.refdes) && lit.add(elId(n.refdes)))
            return { ...p, lit, traceDrawn: true }
          })
          break
        }
        case 'data-inspect': {
          const refdes = String(data.refdes ?? '')
          if (data.found !== false && BOARD_ELEMENTS.has(refdes)) {
            setState((p) => {
              const lit = new Set(p.lit)
              lit.add(elId(refdes))
              return { ...p, lit }
            })
          }
          break
        }
        case 'data-measure': {
          const kind = String(data.kind ?? '')
          const value = Number(data.value)
          const target = String(data.target ?? '')
          if (target) knownNets.current.add(target)
          // Settle the gauge for a voltage reading; show the value on the board.
          if (/volt/i.test(kind) && Number.isFinite(value)) {
            setState((p) => ({ ...p, meterTarget: value, cursorV: `${value.toFixed(2)} V` }))
          }
          break
        }
        case 'data-finding': {
          const refdes = String(data.refdes ?? '')
          if (data.found === false) break
          setState((p) => {
            const fault = new Set(p.fault)
            const lit = new Set(p.lit)
            const callouts = new Set(p.callouts)
            if (BOARD_ELEMENTS.has(refdes)) {
              lit.delete(elId(refdes))
              fault.add(elId(refdes))
              callouts.add('cal2')
            }
            return { ...p, fault, lit, callouts, faultLed: true }
          })
          break
        }
        case 'data-verification': {
          const refdes = String(data.refdes ?? '')
          const verified = Boolean(data.verified)
          const raw = (data.checks as { label: string; pass: boolean }[]) ?? []
          setState((p) => ({
            ...p,
            verification: { refdes, verified, checks: raw },
          }))
          break
        }
      }
    },
    [flushLiveEntry],
  )

  const runLive = useCallback(
    async (symptom: string) => {
      reset()
      knownNets.current = new Set()
      liveBuf.current = null
      liveErrored.current = false
      liveOutputCount.current = 0
      // Seed the console with the tech's message and enter live/busy mode.
      setTimeout(() => {
        setState((p) => ({ ...p, live: true, busy: true, thinking: true }))
        pushUserEntry(symptom)
      }, 30)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ symptom }),
          signal: controller.signal,
        })

        // No model credentials / no device -> JSON fallback signal.
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) {
          const body = (await res.json()) as { fallback?: boolean }
          if (body.fallback) {
            replay()
            return
          }
        }
        if (!res.ok) throw new Error(`diagnose ${res.status}`)

        for await (const chunk of parseSSEStream(res)) {
          handleChunk(chunk)
        }
        flushLiveEntry()

        // If the stream errored mid-flight (model/billing) with no usable
        // output, fall back to the scripted run so it's never a dead end.
        if (liveErrored.current && liveOutputCount.current === 0) {
          replay()
          return
        }
        if (liveErrored.current) {
          setState((p) => ({
            ...p,
            busy: false,
            thinking: false,
            notice: { kind: 'error', text: 'Live model interrupted — showing partial result' },
          }))
          return
        }

        setState((p) => ({ ...p, busy: false, thinking: false }))
      } catch (err) {
        if (controller.signal.aborted) return
        console.log('[v0] live diagnose failed, falling back to scripted run:', err)
        // Never a blank screen — fall back to the scripted sequence.
        replay()
      }
    },
    [reset, replay, pushUserEntry, handleChunk, flushLiveEntry],
  )

  useEffect(() => {
    run()
    return () => {
      clearTimers()
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, replay, runLive }
}
