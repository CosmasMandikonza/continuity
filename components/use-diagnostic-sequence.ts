'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { STEPS, type Step } from '@/lib/continuity-data'

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
}

export function useDiagnosticSequence() {
  const [state, setState] = useState<InstrumentState>(initialState)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

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
    setState({ ...initialState, lit: new Set(), fault: new Set(), callouts: new Set() })
  }, [clearTimers])

  const replay = useCallback(() => {
    reset()
    // run on next tick so reset commits first
    const id = setTimeout(() => run(), 30)
    timers.current.push(id)
  }, [reset, run])

  useEffect(() => {
    run()
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, replay }
}
