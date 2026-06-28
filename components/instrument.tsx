'use client'

import { useCallback } from 'react'
import { useDiagnosticSequence } from './use-diagnostic-sequence'
import { useProvenance } from './use-provenance'
import { Chassis } from './chassis'
import { RailsModule } from './rails-module'
import { FleetPanel } from './fleet-panel'
import { BoardScreen } from './board-screen'
import { DiagnosticConsole } from './diagnostic-console'
import { MeasureGauge } from './measure-gauge'

interface InstrumentProps {
  initialUsage?: { used: number; quota: number } | null
  authEnabled?: boolean
  modelLabel?: string
}

// The Workbench view. The chassis frame, faceplate, nav rail, and footer now
// live in <Chassis>; this component owns only the deck + the live diagnostic
// state it passes up to the shared chrome.
export function Instrument({ initialUsage = null, authEnabled = false, modelLabel = 'AGENT' }: InstrumentProps) {
  const { state, replay, runLive } = useDiagnosticSequence()

  // hovering a citation chip can transiently light its component on the screen.
  const handleLit = useCallback((_compId: string | null) => {
    // Visual lighting from chip hover is intentionally handled by the scripted
    // sequence's persistent state; this hook is the integration point if we
    // want hover-driven highlighting later.
  }, [])

  const { open, close, card } = useProvenance(handleLit)

  return (
    <Chassis
      faultLed={state.faultLed}
      busy={state.busy}
      meterUsage={state.meterUsage ?? initialUsage}
      authEnabled={authEnabled}
      modelLabel={modelLabel}
    >
      {/* deck (bento) */}
      <div className="grid min-h-0 gap-[14px] p-[14px] md:grid-cols-[160px_1fr_330px] lg:grid-cols-[172px_1fr_372px]">
        <div className="hidden min-h-0 flex-col gap-[14px] md:flex">
          <RailsModule />
          <FleetPanel />
        </div>

        {/* screen */}
        <section className="flex min-h-0 flex-col">
          <BoardScreen state={state} />
        </section>

        {/* right column */}
        <div className="grid min-h-0 grid-rows-[1fr_auto] gap-[14px]">
          <DiagnosticConsole
            entries={state.entries}
            thinking={state.thinking}
            busy={state.busy}
            notice={state.notice}
            verification={state.verification}
            onReplay={replay}
            onSubmit={runLive}
            onOpen={open}
            onClose={close}
          />
          <MeasureGauge target={state.meterTarget} />
        </div>
      </div>

      {card}
    </Chassis>
  )
}
