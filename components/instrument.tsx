'use client'

import { useCallback } from 'react'
import { useDiagnosticSequence } from './use-diagnostic-sequence'
import { useProvenance } from './use-provenance'
import { Faceplate } from './faceplate'
import { RailsModule } from './rails-module'
import { FleetPanel } from './fleet-panel'
import { BoardScreen } from './board-screen'
import { DiagnosticConsole } from './diagnostic-console'
import { MeasureGauge } from './measure-gauge'
import { FooterStrip } from './footer-strip'

export function Instrument() {
  const { state, replay, runLive } = useDiagnosticSequence()

  // hovering a citation chip can transiently light its component on the screen.
  const handleLit = useCallback((_compId: string | null) => {
    // Visual lighting from chip hover is intentionally handled by the scripted
    // sequence's persistent state; this hook is the integration point if we
    // want hover-driven highlighting later.
  }, [])

  const { open, close, card } = useProvenance(handleLit)

  return (
    <main
      className="fixed inset-[18px] grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f1ecdf,#e7e1d3)] shadow-[0_1px_0_#fff8ec_inset,0_-22px_50px_-30px_#00000040_inset,0_40px_90px_-40px_#00000070,0_2px_0_#fffaf0]"
    >
      {/* corner rivets */}
      <Rivet className="left-[11px] top-[11px]" />
      <Rivet className="right-[11px] top-[11px]" />
      <Rivet className="bottom-[11px] left-[11px]" />
      <Rivet className="bottom-[11px] right-[11px]" />

      <Faceplate faultLed={state.faultLed} meterUsage={state.meterUsage} />

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

      <FooterStrip busy={state.busy} />

      {card}
    </main>
  )
}

function Rivet({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute z-[6] h-[7px] w-[7px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffaf0,#b3a98f_70%,#968b71)] shadow-[0_1px_1px_#00000040] ${className}`}
    />
  )
}
