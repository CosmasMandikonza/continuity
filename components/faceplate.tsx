'use client'

import Link from 'next/link'
import { AuthControls } from './auth-controls'

interface FaceplateProps {
  faultLed: boolean
  meterUsage?: { used: number; quota: number } | null
  authEnabled?: boolean
  modelLabel?: string
}

export function Faceplate({ faultLed, meterUsage, authEnabled = false, modelLabel = 'AGENT' }: FaceplateProps) {
  const used = meterUsage?.used ?? 142
  const quota = meterUsage?.quota ?? 500
  return (
    <header className="relative flex items-center gap-[18px] border-b-[1.5px] border-rule-strong bg-[linear-gradient(180deg,#efe9db,#00000000)] px-5 pb-3 pt-[13px] after:absolute after:bottom-[-1px] after:left-5 after:right-5 after:h-px after:bg-[#fff8ec] after:content-['']">
      {/* logo */}
      <div className="flex items-center gap-[11px]">
        <svg className="h-[26px] w-[26px] flex-none" viewBox="0 0 30 30" fill="none" aria-hidden>
          <rect x="3" y="3" width="24" height="24" rx="4" stroke="var(--ink)" strokeWidth="1.5" />
          <path
            d="M8 12h6l2.6 2.6H22"
            stroke="var(--flux)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="12" r="1.7" fill="var(--ink)" />
          <circle cx="22" cy="14.6" r="1.7" fill="var(--flux)" />
          <path d="M2 15h2M26 15h2M15 2v2M15 26v2" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <div>
          <div className="font-display text-[16px] font-bold leading-none tracking-[-0.01em]">
            CONTI<span className="text-flux">NUITY</span>
          </div>
          <div className="mt-[3px] font-mono text-[8.5px] tracking-[0.18em] text-ink-3">
            BENCH&nbsp;DIAGNOSTIC&nbsp;INSTRUMENT
          </div>
        </div>
      </div>

      {/* device under test */}
      <div
        className="flex items-center overflow-hidden rounded-[7px] border border-rule-2 bg-[#fff7e9]"
        aria-label="Device under test"
      >
        <span className="border-r border-rule px-[11px] py-[6px] font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-3">
          D.U.T
        </span>
        <span className="border-r border-rule px-[11px] py-[6px] font-mono text-[11px] text-ink-2s">
          MNT Reform
        </span>
        <span className="px-[11px] py-[6px] font-mono text-[11px] text-ink">
          Motherboard&nbsp;<b className="font-semibold text-ink">r3</b>
        </span>
      </div>

      <div className="flex-1" />

      {/* status LEDs */}
      <div className="flex items-center gap-4" aria-hidden>
        <Led label="PWR" on="g" />
        <Led label="LINK" on="g" />
        <Led label="FAULT" on={faultLed ? 'r' : undefined} />
      </div>

      {/* model tier */}
      <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-rule-2 bg-[#fff7e9] px-[11px] py-[5px] font-mono text-[10px] text-ink-2s">
        <span className="h-[6px] w-[6px] rounded-full bg-flux shadow-[0_0_7px_var(--flux)]" />
        {modelLabel}
      </div>
      <Link
        href="/pricing"
        title="Plans & usage"
        className="font-mono text-[10px] text-ink-3 transition-colors hover:text-ink-2s"
      >
        {used >= quota ? (
          <span className="text-probe">QUOTA&nbsp;REACHED&nbsp;·&nbsp;UPGRADE&nbsp;→</span>
        ) : (
          <>
            DIAGNOSTICS&nbsp;<b className="font-semibold text-ink-2s">{used}</b>/{quota}
          </>
        )}
      </Link>
      {authEnabled && <AuthControls />}
    </header>
  )
}

function Led({ label, on }: { label: string; on?: 'g' | 'r' }) {
  const base = 'h-[9px] w-[9px] rounded-full shadow-[0_0_0_1px_#00000018_inset]'
  const lit =
    on === 'g'
      ? 'bg-phos shadow-[0_0_9px_#39f0a3,0_0_0_1px_#1d6e4d]'
      : on === 'r'
        ? 'animate-blink bg-probe shadow-[0_0_10px_#ff5247,0_0_0_1px_#8a1f1a]'
        : 'bg-[#c9c0ad]'
  return (
    <div className="flex flex-col items-center gap-[5px]">
      <span className={`${base} ${lit}`} />
      <span className="font-mono text-[7.5px] tracking-[0.12em] text-ink-3">{label}</span>
    </div>
  )
}
