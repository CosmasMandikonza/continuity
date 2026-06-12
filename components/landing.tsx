'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { FleetSummary } from '@/lib/queries'

const CHECKS = [
  'C29 resolves to a component row',
  'sits on the traced path from PP5V0_SYS',
  'measurement consistent with an open cap',
]

function Logo({ className = 'h-[26px] w-[26px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 30" fill="none" aria-hidden>
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
  )
}

// The signature moment: an agent proposes a culprit, then the database verifies
// each claim against the electrical graph, one row at a time.
function VerifyScreen() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState(reduce ? 3 : 0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setPhase((p) => (p + 1) % 5), 900)
    return () => clearInterval(id)
  }, [reduce])

  const verified = phase >= 3

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[#04130f] bg-[radial-gradient(130%_120%_at_50%_-10%,#10150f,#0b0e0c_58%,#070a08)] shadow-[0_0_0_1px_#1b2a23_inset,0_28px_60px_-30px_#000_inset,0_30px_70px_-40px_#00000099]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'radial-gradient(circle, #16271f 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-[40%] bg-[linear-gradient(180deg,#39f0a312,transparent)]"
          initial={{ y: '-40%' }}
          animate={{ y: '160%' }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <div className="relative flex items-center gap-2 border-b border-[#152a22] px-4 py-[9px]">
        <span className="h-[6px] w-[6px] rounded-full bg-phos shadow-[0_0_7px_#39f0a3]" />
        <span className="font-mono text-[9.5px] tracking-[0.08em] text-phos/80">
          diagnose · MNT Reform r3
        </span>
        <span className="ml-auto font-mono text-[8.5px] tracking-[0.08em] text-comp/60">
          live agent
        </span>
      </div>

      <div className="relative space-y-[10px] px-4 py-[16px] font-mono text-[11px] leading-[1.5]">
        <div className="text-comp/70">
          <span className="text-comp/40">tech ›</span> no power. PP5V0 reads 0.31&nbsp;V.
        </div>

        <div className="rounded-[8px] border border-[#1c3a2e] bg-[#0c130f] p-[11px]">
          <div className="flex items-center gap-2 text-phos/60">
            <span className="text-[8px] uppercase tracking-[0.14em]">proposed root cause</span>
          </div>
          <div className="mt-[6px] flex items-baseline gap-[8px]">
            <span className="text-[20px] font-bold leading-none text-probe">C29</span>
            <span className="text-[11px] text-comp/80">input cap · PP5V0_SYS · open</span>
          </div>

          <div className="mt-[12px] space-y-[6px] border-t border-dashed border-[#1c3a2e] pt-[10px]">
            {CHECKS.map((c, i) => {
              const done = phase >= i + 1
              return (
                <div
                  key={c}
                  className="flex items-center gap-[8px] text-[10px] transition-colors duration-300"
                  style={{ color: done ? '#39f0a3' : '#3f5a50' }}
                >
                  <span
                    className="grid h-[13px] w-[13px] flex-none place-items-center rounded-full border text-[8px] transition-colors duration-300"
                    style={{
                      borderColor: done ? '#39f0a3' : '#2a463b',
                      color: done ? '#39f0a3' : '#2a463b',
                    }}
                  >
                    {done ? '✓' : ''}
                  </span>
                  {c}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-[2px]">
          <span className="text-[9px] tracking-[0.06em] text-phos/40">
            checked against electrical_graph
          </span>
          <motion.span
            initial={false}
            animate={{ opacity: verified ? 1 : 0.18, scale: verified ? 1 : 0.96 }}
            transition={{ duration: 0.3 }}
            className="rounded-[5px] border border-phos/50 bg-phos/10 px-[9px] py-[3px] text-[9px] font-semibold uppercase tracking-[0.14em] text-phos"
          >
            {verified ? 'verified ✓' : 'verifying…'}
          </motion.span>
        </div>
      </div>
    </div>
  )
}

export function Landing({ topCause }: { topCause: FleetSummary | null }) {
  const reduce = useReducedMotion()
  const pct = topCause ? Math.round(topCause.pct) : 58
  const refdes = topCause?.refdes ?? 'C29'
  const repairs = topCause?.totalRepairs ?? 12

  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: 'easeOut' },
        }

  return (
    <main className="min-h-dvh px-5 pb-16 pt-5 md:px-8">
      <div className="mx-auto max-w-[1120px]">
        {/* top bar */}
        <header className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="font-display text-[15px] font-bold leading-none tracking-[-0.01em]">
              CONTI<span className="text-flux">NUITY</span>
            </div>
            <div className="mt-[3px] font-mono text-[8px] tracking-[0.18em] text-ink-3">
              BENCH&nbsp;DIAGNOSTIC&nbsp;INSTRUMENT
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/bench"
              className="rounded-full border border-flux bg-flux px-[16px] py-[8px] font-mono text-[11px] font-semibold text-[#fff7e9] shadow-[0_8px_20px_-10px_var(--flux)] transition-transform hover:-translate-y-[1px]"
            >
              Open the bench&nbsp;→
            </Link>
          </div>
        </header>

        {/* hero */}
        <section className="mt-12 grid items-center gap-10 md:mt-16 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
          <motion.div {...rise(0.02)}>
            <span className="ucl text-[11px] text-flux-ink">Board-level repair · grounded in a real graph</span>
            <h1 className="mt-[14px] font-display text-[40px] font-bold leading-[1.02] tracking-[-0.02em] text-ink md:text-[52px]">
              An AI repair tech that <span className="text-flux">can&rsquo;t</span> make up a part.
            </h1>
            <p className="mt-[18px] max-w-[30rem] font-sans text-[15px] leading-[1.6] text-ink-2s">
              Continuity diagnoses board-level electronics faults. Every component it names resolves
              to a real row in the electrical graph — and a deterministic check re-runs each finding
              against the schematic before it ever reaches you.
            </p>
            <div className="mt-[26px] flex flex-wrap items-center gap-3">
              <Link
                href="/bench"
                className="rounded-full border border-flux bg-flux px-[20px] py-[11px] font-mono text-[12px] font-semibold text-[#fff7e9] shadow-[0_10px_26px_-12px_var(--flux)] transition-transform hover:-translate-y-[1px]"
              >
                Open the bench&nbsp;→
              </Link>
              <Link
                href="/graph"
                className="rounded-full border border-rule-2 bg-[#fff7e9] px-[20px] py-[11px] font-mono text-[12px] text-ink-2s transition-colors hover:border-rule-strong"
              >
                See the live graph
              </Link>
            </div>
            <div className="mt-[22px] font-mono text-[10.5px] tracking-[0.02em] text-ink-3">
              powered by <b className="font-semibold text-ink-2s">Aurora PostgreSQL + pgvector</b>{' '}
              on Vercel
            </div>
          </motion.div>

          <motion.div {...rise(0.16)}>
            <VerifyScreen />
          </motion.div>
        </section>

        {/* the pipeline — three beats */}
        <section className="mt-20 grid gap-5 md:mt-24 md:grid-cols-3">
          <Beat
            n="01"
            title="Grounded in a real graph"
            body="Components, nets, and pins are first-class rows. The agent learns the board only through SQL — a recursive trace walks the power path, and an unknown refdes returns “no such part,” never a guess."
            delay={0.02}
          />
          <Beat
            n="02"
            title="Verified, not vibes"
            body="A deterministic checker re-runs every finding against the graph: does the cited part exist, is it on the faulted path, is the measurement consistent? Anything that fails is flagged ⚠ before you see it."
            delay={0.1}
          />
          <Beat
            n="03"
            title="Smarter with every shop"
            body={`Across the fleet, ${refdes} is the confirmed root cause ${pct}% of the time for this fault — computed by a privacy-preserving aggregate. Your repairs stay private; only the rates cross the boundary.`}
            delay={0.18}
          />
        </section>

        {/* stats strip */}
        <motion.section
          {...rise(0.05)}
          className="mt-16 grid grid-cols-2 overflow-hidden rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset] md:grid-cols-4"
        >
          <Stat k={`${pct}%`} v="top cross-shop root cause" />
          <Stat k={`${repairs}`} v="confirmed repairs in the fleet" border />
          <Stat k="1024-d" v="part embeddings · pgvector" border />
          <Stat k="0" v="ungrounded citations allowed" border />
        </motion.section>

        {/* footer */}
        <footer className="mt-14 flex flex-col items-center gap-2 border-t border-rule pt-8 text-center">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.06em] text-ink-3">
            <span>Aurora PostgreSQL + pgvector</span>
            <span className="text-rule-strong">·</span>
            <span>row-level multi-tenant</span>
            <span className="text-rule-strong">·</span>
            <span>Next.js on Vercel</span>
          </div>
          <Link href="/bench" className="font-mono text-[10px] text-flux-ink underline-offset-2 hover:underline">
            Open the bench →
          </Link>
        </footer>
      </div>
    </main>
  )
}

function Beat({
  n,
  title,
  body,
  delay = 0,
}: {
  n: string
  title: string
  body: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className="relative rounded-[13px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[18px] shadow-[0_1px_0_#fff8ec_inset,0_18px_36px_-28px_#00000055]"
    >
      <div className="flex items-center gap-[9px]">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-full border border-flux/40 font-mono text-[9px] font-semibold text-flux-ink">
          {n}
        </span>
        <span className="ucl text-[11px] text-ink">{title}</span>
      </div>
      <p className="mt-[11px] font-sans text-[12.5px] leading-[1.55] text-ink-2s">{body}</p>
    </motion.div>
  )
}

function Stat({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <div className={`px-[18px] py-[18px] ${border ? 'border-l border-rule' : ''}`}>
      <div className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-flux-ink">
        {k}
      </div>
      <div className="mt-[7px] font-mono text-[9.5px] leading-[1.4] text-ink-3">{v}</div>
    </div>
  )
}
