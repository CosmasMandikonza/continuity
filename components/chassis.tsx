'use client'

import type { ReactNode } from 'react'
import { Faceplate } from './faceplate'
import { FooterStrip } from './footer-strip'
import { NavRail } from './nav-rail'

interface ChassisProps {
  children: ReactNode
  faultLed?: boolean
  busy?: boolean
  meterUsage?: { used: number; quota: number } | null
  authEnabled?: boolean
}

// The instrument frame, shared by every view. The faceplate + footer carry live
// state on the Workbench (faultLed, busy) and sit quiet on the other views. The
// children are placed directly as the second column so a view's own grid/flex
// fills the deck height exactly as the original single-screen layout did.
export function Chassis({
  children,
  faultLed = false,
  busy = false,
  meterUsage = null,
  authEnabled = false,
}: ChassisProps) {
  return (
    <main className="fixed inset-[18px] grid grid-rows-[auto_1fr_auto] overflow-hidden rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f1ecdf,#e7e1d3)] shadow-[0_1px_0_#fff8ec_inset,0_-22px_50px_-30px_#00000040_inset,0_40px_90px_-40px_#00000070,0_2px_0_#fffaf0]">
      <Rivet className="left-[11px] top-[11px]" />
      <Rivet className="right-[11px] top-[11px]" />
      <Rivet className="bottom-[11px] left-[11px]" />
      <Rivet className="bottom-[11px] right-[11px]" />

      <Faceplate faultLed={faultLed} meterUsage={meterUsage} authEnabled={authEnabled} />

      <div className="grid min-h-0 grid-cols-[58px_minmax(0,1fr)]">
        <NavRail />
        {children}
      </div>

      <FooterStrip busy={busy} />
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
