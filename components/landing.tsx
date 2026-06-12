'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { FleetSummary } from '@/lib/queries'

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

const STATUS = ['ready', 'fault', 'tracing', 'isolating', 'verified', 'verified']
const STATUS_COLOR = ['#39f0a3', '#ffc24d', '#f06a1f', '#ff5247', '#39f0a3', '#39f0a3']

// The signature moment, as the product's real artifact: an animated schematic of
// the power path where a no-power fault is traced to a shorted cap and then
// verified against the electrical graph. Not a terminal — a precision readout.
function DiagnosticTrace() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState(reduce ? 5 : 0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setPhase((p) => (p + 1) % 6), 1150)
    return () => clearInterval(id)
  }, [reduce])

  const symptom = phase >= 1
  const tracing = phase >= 2
  const culprit = phase >= 3
  const verified = phase >= 4
  const status = STATUS[phase]
  const statusColor = STATUS_COLOR[phase]

  return (
    <div className="relative rounded-[16px] border border-[#0a1f18] bg-[radial-gradient(120%_120%_at_30%_-10%,#12211b,#0a0f0c_55%,#060a08)] p-[4px] shadow-[0_42px_90px_-38px_#000000b0,0_2px_0_#2c4a3e_inset]">
      <div className="relative overflow-hidden rounded-[12px] border border-[#10261e] bg-[#070b09]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[44%] rounded-t-[12px] bg-[linear-gradient(180deg,#ffffff0d,transparent)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle, #15281f 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative flex items-center gap-2 border-b border-[#11261e] px-4 py-[9px]">
          <motion.span
            className="h-[7px] w-[7px] rounded-full"
            animate={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
            transition={{ duration: 0.3 }}
          />
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-phos/70">DIAGNOSTIC TRACE</span>
          <span className="font-mono text-[9px] text-comp/40">· MNT Reform r3</span>
          <motion.span
            className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em]"
            animate={{ color: statusColor }}
            transition={{ duration: 0.3 }}
          >
            {status}
          </motion.span>
        </div>

        <svg
          viewBox="0 0 600 360"
          className="relative block w-full"
          role="img"
          aria-label="Animated schematic tracing a no-power fault to a shorted capacitor on the PP5V0 rail"
        >
          <defs>
            <filter id="trGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <text x="26" y="62" fontFamily="var(--font-mono)" fontSize="11" fill="#39f0a3" opacity="0.8">
            PP5V0_SYS
          </text>
          <text x="26" y="78" fontFamily="var(--font-mono)" fontSize="9" fill="#39f0a3" opacity="0.4">
            5.0 V nominal
          </text>

          <text x="24" y="142" fontFamily="var(--font-mono)" fontSize="9" fill="#86d9ff" opacity="0.55">
            VBAT
          </text>
          <line x1="56" y1="155" x2="92" y2="155" stroke="#2f7d63" strokeWidth="1.4" />
          <line x1="68" y1="148" x2="68" y2="162" stroke="#3aa6cf" strokeWidth="1.6" opacity="0.7" />
          <line x1="74" y1="151" x2="74" y2="159" stroke="#3aa6cf" strokeWidth="1.6" opacity="0.7" />

          <rect x="92" y="120" width="80" height="70" rx="6" fill="#0a120e" stroke="#3aa6cf" strokeWidth="1.4" opacity="0.9" />
          <text x="132" y="151" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="15" fontWeight="700" fill="#86d9ff">
            U1
          </text>
          <text x="132" y="167" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="#86d9ff" opacity="0.55">
            PMIC
          </text>

          <motion.line
            x1="172"
            y1="150"
            x2="470"
            y2="150"
            strokeWidth="2"
            animate={{ stroke: symptom ? '#ffc24d' : '#2f7d63', opacity: symptom ? 0.95 : 0.7 }}
            transition={{ duration: 0.4 }}
          />

          <circle cx="232" cy="150" r="5" fill="#070b09" stroke="#2f7d63" strokeWidth="1.4" />
          <text x="232" y="134" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="#39f0a3" opacity="0.45">
            TP12
          </text>

          <rect x="470" y="122" width="70" height="58" rx="6" fill="#0a120e" stroke="#3aa6cf" strokeWidth="1.4" opacity="0.9" />
          <text x="505" y="149" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700" fill="#86d9ff">
            J15
          </text>
          <text x="505" y="165" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="#86d9ff" opacity="0.55">
            load
          </text>

          <circle cx="320" cy="150" r="3" fill="#2f7d63" />
          <line x1="320" y1="150" x2="320" y2="196" stroke="#2f7d63" strokeWidth="1.6" opacity="0.7" />
          <motion.line
            x1="304"
            y1="198"
            x2="336"
            y2="198"
            strokeWidth="2.6"
            animate={{ stroke: culprit ? '#ff5247' : '#86d9ff' }}
            transition={{ duration: 0.3 }}
            style={{ filter: culprit ? 'url(#trGlow)' : 'none' }}
          />
          <motion.line
            x1="304"
            y1="206"
            x2="336"
            y2="206"
            strokeWidth="2.6"
            animate={{ stroke: culprit ? '#ff5247' : '#86d9ff' }}
            transition={{ duration: 0.3 }}
            style={{ filter: culprit ? 'url(#trGlow)' : 'none' }}
          />
          <line x1="320" y1="206" x2="320" y2="250" stroke="#2f7d63" strokeWidth="1.6" opacity="0.7" />
          <line x1="305" y1="250" x2="335" y2="250" stroke="#2f7d63" strokeWidth="1.6" />
          <line x1="311" y1="256" x2="329" y2="256" stroke="#2f7d63" strokeWidth="1.6" opacity="0.7" />
          <line x1="316" y1="262" x2="324" y2="262" stroke="#2f7d63" strokeWidth="1.6" opacity="0.5" />
          <motion.text
            x="346"
            y="199"
            fontFamily="var(--font-mono)"
            fontSize="13"
            fontWeight="700"
            animate={{ fill: culprit ? '#ff5247' : '#86d9ff' }}
            transition={{ duration: 0.3 }}
          >
            C29
          </motion.text>
          <text x="346" y="213" fontFamily="var(--font-mono)" fontSize="8.5" fill="#86d9ff" opacity="0.55">
            input cap
          </text>

          {culprit && !reduce && (
            <motion.circle
              cx="320"
              cy="202"
              fill="none"
              stroke="#ff5247"
              strokeWidth="1.5"
              initial={{ r: 12, opacity: 0.7 }}
              animate={{ r: 27, opacity: 0 }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeOut' }}
            />
          )}

          <motion.path
            d="M172 150 L320 150 L320 192"
            fill="none"
            stroke="#f06a1f"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: tracing ? 1 : 0, opacity: tracing ? 1 : 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 5px #f06a1f)' }}
          />

          <motion.g
            initial={false}
            animate={{ opacity: symptom ? 1 : 0, y: symptom ? 0 : -5 }}
            transition={{ duration: 0.3 }}
          >
            <line x1="300" y1="150" x2="300" y2="98" stroke="#ffc24d" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
            <rect x="248" y="76" width="120" height="24" rx="5" fill="#16100a" stroke="#5a3d14" />
            <text x="260" y="92" fontFamily="var(--font-mono)" fontSize="10" fill="#ff5247">
              PP5V0 = 0.31 V
            </text>
            <text x="350" y="92" fontFamily="var(--font-mono)" fontSize="11" fill="#ff5247">
              ✕
            </text>
          </motion.g>

          <motion.g initial={false} animate={{ opacity: culprit ? 1 : 0 }} transition={{ duration: 0.35 }}>
            <line x1="334" y1="204" x2="404" y2="248" stroke="#ff5247" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
            <circle cx="412" cy="252" r="11" fill="#0a120e" stroke="#ff5247" strokeWidth="1.4" />
            <text x="412" y="256" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="#ff5247">
              1
            </text>
            <text x="430" y="250" fontFamily="var(--font-mono)" fontSize="11" fontWeight="600" fill="#ff7a6e">
              C29 · shorted
            </text>
            <text x="430" y="264" fontFamily="var(--font-mono)" fontSize="8.5" fill="#ff7a6e" opacity="0.65">
              drags PP5V0 to GND
            </text>
          </motion.g>

          <line x1="172" y1="318" x2="470" y2="318" stroke="#1c3a2e" strokeWidth="1" />
          <line x1="172" y1="313" x2="172" y2="323" stroke="#1c3a2e" strokeWidth="1" />
          <line x1="470" y1="313" x2="470" y2="323" stroke="#1c3a2e" strokeWidth="1" />
          <text x="321" y="336" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="#2f7d63" opacity="0.6">
            PP5V0_SYS · 1 net · 6 nodes
          </text>

          <motion.g
            initial={false}
            animate={{ opacity: verified ? 1 : 0, y: verified ? 0 : 6 }}
            transition={{ duration: 0.4 }}
          >
            <rect x="386" y="278" width="176" height="26" rx="13" fill="#0c1a13" stroke="#1f7a52" />
            <circle cx="402" cy="291" r="7" fill="none" stroke="#39f0a3" strokeWidth="1.4" />
            <text x="402" y="294.5" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#39f0a3">
              ✓
            </text>
            <text x="416" y="295" fontFamily="var(--font-mono)" fontSize="9" fill="#39f0a3">
              resolves to a real row
            </text>
          </motion.g>
        </svg>
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
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: 'easeOut' },
        }

  return (
    <main className="min-h-dvh px-5 pb-16 pt-5 md:px-8">
      <div className="mx-auto max-w-[1180px]">
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

        <section className="mt-12 grid items-center gap-10 md:mt-16 md:grid-cols-[1.04fr_0.96fr] md:gap-12">
          <motion.div {...rise(0.02)}>
            <span className="ucl text-[11px] text-flux-ink">For the repair bench · grounded in a real graph</span>
            <h1 className="mt-[14px] font-display text-[40px] font-bold leading-[1.02] tracking-[-0.02em] text-ink md:text-[52px]">
              An AI repair tech that <span className="text-flux">can&rsquo;t</span> make up a part.
            </h1>
            <p className="mt-[18px] max-w-[31rem] font-sans text-[15px] leading-[1.6] text-ink-2s">
              Continuity takes a dead board from symptom to a single component — and because every
              part it names is a real row in the electrical graph, your tech can probe the exact pin
              instead of trusting a guess.
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

          <motion.div {...rise(0.18)}>
            <DiagnosticTrace />
          </motion.div>
        </section>

        <motion.p
          {...rise(0.05)}
          className="mx-auto mt-20 max-w-[54rem] text-center font-display text-[19px] font-medium leading-[1.45] tracking-[-0.01em] text-ink-2s md:mt-24 md:text-[23px]"
        >
          Board-level diagnosis still lives in one senior tech&rsquo;s head. Continuity turns that
          instinct into a verifiable instrument the whole bench can trust — so a dead board becomes a
          single refdes, <span className="text-ink">not an afternoon of swap-and-pray.</span>
        </motion.p>

        <section className="mt-14 grid gap-5 md:mt-16 md:grid-cols-3">
          <Beat
            n="01"
            title="From symptom to one refdes"
            body="The agent walks the board’s power path through SQL — a recursive trace over real components, nets, and pins. Ask it about a part that isn’t on the board and it tells you so. It cannot invent one."
            delay={0.02}
          />
          <Beat
            n="02"
            title="Verified by the database, not the model"
            body="Every finding is re-checked against the graph before it reaches you: does the cited part exist, does it sit on the faulted net, is the measurement consistent? Claims that fail are flagged, not shipped."
            delay={0.1}
          />
          <Beat
            n="03"
            title="Your whole fleet, one baseline"
            body={`Across the shops, ${refdes} is the confirmed culprit ${pct}% of the time for this fault — so you stock it ahead of the call. A privacy-preserving aggregate does the math; your repairs stay yours, only the rates cross the line.`}
            delay={0.18}
          />
        </section>

        <motion.section
          {...rise(0.05)}
          className="mt-16 grid grid-cols-2 overflow-hidden rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset] md:grid-cols-4"
        >
          <Stat k={`${pct}%`} v="top cross-shop root cause" />
          <Stat k={`${repairs}`} v="repairs in the shared fleet" border />
          <Stat k="1024-d" v="part embeddings · pgvector" border />
          <Stat k="0" v="hallucinated parts" border />
        </motion.section>

        <footer className="mt-14 flex flex-col items-center gap-2 border-t border-rule pt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] tracking-[0.06em] text-ink-3">
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
      initial={reduce ? false : { opacity: 0, y: 16 }}
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
      <div className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-flux-ink">{k}</div>
      <div className="mt-[7px] font-mono text-[9.5px] leading-[1.4] text-ink-3">{v}</div>
    </div>
  )
}
