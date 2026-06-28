'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { FleetSummary } from '@/lib/queries'

/* ───────────────────────── shared bits ───────────────────────── */

function Logo({ className = 'h-[26px] w-[26px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="3" y="3" width="24" height="24" rx="4" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M8 12h6l2.6 2.6H22" stroke="var(--flux)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="1.7" fill="var(--ink)" />
      <circle cx="22" cy="14.6" r="1.7" fill="var(--flux)" />
      <path d="M2 15h2M26 15h2M15 2v2M15 26v2" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

function SectionLabel({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] font-semibold text-flux-ink">{n}</span>
      <span className="h-px w-8 bg-rule-strong" />
      <span className="ucl text-[10px] text-ink-3">{children}</span>
    </div>
  )
}

/* ───────────────────── the board that proves itself ───────────────────── */

function chipPins(side: 'top' | 'bottom' | 'left' | 'right', x: number, y: number, w: number, h: number, n: number) {
  const out: ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const k = side + i
    if (side === 'top') out.push(<line key={k} x1={x + t * w} y1={y} x2={x + t * w} y2={y - 4} stroke="#2a5648" strokeWidth="1" />)
    else if (side === 'bottom') out.push(<line key={k} x1={x + t * w} y1={y + h} x2={x + t * w} y2={y + h + 4} stroke="#2a5648" strokeWidth="1" />)
    else if (side === 'left') out.push(<line key={k} x1={x} y1={y + t * h} x2={x - 4} y2={y + t * h} stroke="#2a5648" strokeWidth="1" />)
    else out.push(<line key={k} x1={x + w} y1={y + t * h} x2={x + w + 4} y2={y + t * h} stroke="#2a5648" strokeWidth="1" />)
  }
  return out
}

function Chip({
  x,
  y,
  w,
  h,
  label,
  sub,
  perSide = 8,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  perSide?: number
}) {
  return (
    <g>
      {chipPins('top', x, y, w, h, perSide)}
      {chipPins('bottom', x, y, w, h, perSide)}
      {chipPins('left', x, y, w, h, perSide)}
      {chipPins('right', x, y, w, h, perSide)}
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#0a140f" stroke="#3aa6cf" strokeWidth="1.2" opacity="0.85" />
      <text x={x + w / 2} y={y + h / 2 - (sub ? 3 : -3)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="700" fill="#86d9ff">
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="#86d9ff" opacity="0.55">
          {sub}
        </text>
      )}
    </g>
  )
}

const PASSIVES: [number, number, number, number][] = [
  [206, 250, 12, 5], [228, 250, 12, 5], [250, 252, 5, 11], [120, 150, 12, 5],
  [120, 162, 12, 5], [262, 120, 5, 11], [262, 136, 5, 11], [430, 270, 12, 5],
  [452, 270, 12, 5], [556, 210, 5, 11], [556, 226, 5, 11], [330, 286, 12, 5],
  [150, 290, 5, 11], [500, 286, 12, 5],
]

const STATUS = ['ready', 'fault', 'tracing', 'isolating', 'grounded', 'grounded']
const STATUS_COLOR = ['#39f0a3', '#ffc24d', '#f06a1f', '#ff5247', '#39f0a3', '#39f0a3']

function BoardProof() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState(reduce ? 5 : 0)

  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setPhase((p) => (p + 1) % 6), 1250)
    return () => clearInterval(id)
  }, [reduce])

  const symptom = phase >= 1
  const tracing = phase >= 2
  const culprit = phase >= 3
  const proven = phase >= 4

  return (
    <div className="relative rounded-[16px] border border-[#0a1f18] bg-[radial-gradient(120%_120%_at_30%_-10%,#12211b,#0a0f0c_55%,#060a08)] p-[4px] shadow-[0_44px_92px_-38px_#000000b8,0_2px_0_#2c4a3e_inset]">
      <div className="relative overflow-hidden rounded-[12px] border border-[#10261e] bg-[#070b09]">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[40%] rounded-t-[12px] bg-[linear-gradient(180deg,#ffffff0d,transparent)]" />

        <div className="relative flex items-center gap-2 border-b border-[#11261e] px-4 py-[9px]">
          <motion.span className="h-[7px] w-[7px] rounded-full" animate={{ backgroundColor: STATUS_COLOR[phase], boxShadow: `0 0 8px ${STATUS_COLOR[phase]}` }} transition={{ duration: 0.3 }} />
          <span className="font-mono text-[9.5px] tracking-[0.12em] text-phos/70">MNT REFORM</span>
          <span className="font-mono text-[9px] text-comp/40">· motherboard r3</span>
          <motion.span className="ml-auto font-mono text-[9px] uppercase tracking-[0.16em]" animate={{ color: STATUS_COLOR[phase] }} transition={{ duration: 0.3 }}>
            {STATUS[phase]}
          </motion.span>
        </div>

        <svg viewBox="0 0 660 400" className="relative block w-full" role="img" aria-label="Live diagnostic on the MNT Reform board: a no-power fault traced to shorted capacitor C29 and verified against the database">
          <defs>
            <filter id="bGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── static board ───────────────────────────── */}
          <g>
            <rect x="20" y="22" width="620" height="356" rx="10" fill="#07110c" stroke="#163528" strokeWidth="1.5" />
            <rect x="30" y="32" width="600" height="336" rx="6" fill="none" stroke="#12281f" strokeWidth="1" strokeDasharray="1 6" opacity="0.6" />
            {[[44, 46], [616, 46], [44, 354], [616, 354]].map(([cx, cy], i) => (
              <g key={i}>
                <circle cx={cx} cy={cy} r="6" fill="#0a1a13" stroke="#1c3a2e" strokeWidth="1.2" />
                <circle cx={cx} cy={cy} r="2.4" fill="#040806" />
              </g>
            ))}
            <text x="600" y="44" textAnchor="end" fontFamily="var(--font-mono)" fontSize="7.5" fill="#1f4d3e">MNT REFORM r3</text>

            {/* power input */}
            <rect x="22" y="176" width="22" height="56" rx="2" fill="#0a1a13" stroke="#3aa6cf" strokeWidth="1.2" opacity="0.85" />
            <text x="33" y="246" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="#86d9ff" opacity="0.6">J1</text>
            <line x1="44" y1="204" x2="110" y2="204" stroke="#234d40" strokeWidth="1.4" />

            {/* PMIC */}
            <Chip x={110} y={176} w={64} h={56} label="U1" sub="PMIC" perSide={7} />
            <text x="142" y="170" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="#86d9ff" opacity="0.5">U1</text>

            {/* dim power rail (recolors on symptom) */}
            <line x1="174" y1="204" x2="280" y2="204" stroke="#234d40" strokeWidth="2" />

            {/* CPU + BGA */}
            <Chip x={280} y={108} w={140} h={140} label="" perSide={14} />
            {Array.from({ length: 10 }).map((_, r) =>
              Array.from({ length: 10 }).map((_, c) => (
                <circle key={`${r}-${c}`} cx={296 + c * 12} cy={124 + r * 12} r="1.7" fill="#1f4d3e" />
              )),
            )}
            <rect x="294" y="116" width="48" height="13" rx="2" fill="#091310" />
            <text x="300" y="126" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700" fill="#86d9ff">U2</text>
            <text x="350" y="100" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="#86d9ff" opacity="0.55">i.MX 8M Plus</text>

            {/* DRAM */}
            <Chip x={448} y={108} w={86} h={60} label="U10" sub="DRAM" perSide={9} />
            <Chip x={448} y={188} w={86} h={60} label="U11" sub="DRAM" perSide={9} />

            {/* misc QFN */}
            <Chip x={548} y={148} w={40} h={40} label="U9" perSide={6} />
            <Chip x={548} y={250} w={40} h={40} label="" perSide={6} />

            {/* passives */}
            {PASSIVES.map(([px, py, pw, ph], i) => (
              <rect key={i} x={px} y={py} width={pw} height={ph} rx="1" fill="#10241c" stroke="#2a5648" strokeWidth="0.8" />
            ))}

            {/* signal bus CPU↔DRAM */}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={i} x1={420} y1={130 + i * 6} x2={448} y2={130 + i * 6} stroke="#1c3a2e" strokeWidth="0.8" />
            ))}

            {/* mPCIe gold-finger slot */}
            <rect x="250" y="300" width="180" height="16" rx="2" fill="#0c1812" stroke="#3a5a1e" strokeWidth="1" />
            {Array.from({ length: 30 }).map((_, i) => (
              <line key={i} x1={256 + i * 5.8} y1={302} x2={256 + i * 5.8} y2={314} stroke="#caa23d" strokeWidth="1.4" opacity="0.55" />
            ))}
            <text x="340" y="328" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="#86d9ff" opacity="0.45">mPCIe</text>

            {/* edge connectors */}
            {[['USB-C', 70], ['HDMI', 140], ['ETH', 470], ['USB-A', 540]].map(([lbl, ex], i) => (
              <g key={i}>
                <rect x={ex as number} y={332} width="46" height="18" rx="2" fill="#0a1a13" stroke="#3aa6cf" strokeWidth="1.1" opacity="0.8" />
                {Array.from({ length: 5 }).map((_, j) => (
                  <line key={j} x1={(ex as number) + 6 + j * 8.5} y1={350} x2={(ex as number) + 6 + j * 8.5} y2={356} stroke="#234d40" strokeWidth="1" />
                ))}
                <text x={(ex as number) + 23} y={344} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6.5" fill="#86d9ff" opacity="0.5">{lbl}</text>
              </g>
            ))}
          </g>

          {/* ── dynamic diagnostic layer ───────────────── */}
          {/* amber rail on symptom */}
          <motion.line x1="174" y1="204" x2="280" y2="204" stroke="#ffc24d" strokeWidth="2" initial={false} animate={{ opacity: symptom ? 0.95 : 0 }} transition={{ duration: 0.4 }} />

          {/* symptom readout */}
          <motion.g initial={false} animate={{ opacity: symptom ? 1 : 0, y: symptom ? 0 : -5 }} transition={{ duration: 0.3 }}>
            <line x1="227" y1="204" x2="227" y2="150" stroke="#ffc24d" strokeWidth="1" strokeDasharray="2 2" opacity="0.55" />
            <rect x="168" y="128" width="120" height="22" rx="5" fill="#16100a" stroke="#5a3d14" />
            <text x="180" y="143" fontFamily="var(--font-mono)" fontSize="10" fill="#ff5247">PP5V0 = 0.31 V</text>
            <text x="270" y="143" fontFamily="var(--font-mono)" fontSize="11" fill="#ff5247">✕</text>
          </motion.g>

          {/* flux diagnostic trace */}
          <motion.path
            d="M174 204 L227 204 L227 196"
            fill="none"
            stroke="#f06a1f"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: tracing ? 1 : 0, opacity: tracing ? 1 : 0 }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 5px #f06a1f)' }}
          />

          {/* board dim when proven */}
          <motion.rect x="20" y="22" width="620" height="356" rx="10" fill="#050a07" initial={false} animate={{ opacity: proven ? 0.55 : 0 }} transition={{ duration: 0.45 }} />

          {/* C29 (always above dim) */}
          <g>
            <motion.rect x="220" y="196" width="14" height="22" rx="1.5" stroke="#0a140f" strokeWidth="0.5" initial={false} animate={{ fill: culprit ? '#ff5247' : '#86d9ff' }} transition={{ duration: 0.3 }} style={{ filter: culprit ? 'url(#bGlow)' : 'none' }} />
            <line x1="227" y1="218" x2="227" y2="234" stroke="#234d40" strokeWidth="1.4" />
            <line x1="219" y1="234" x2="235" y2="234" stroke="#234d40" strokeWidth="1.4" />
            <line x1="222" y1="238" x2="232" y2="238" stroke="#234d40" strokeWidth="1.2" opacity="0.7" />
            <motion.text x="240" y="204" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" initial={false} animate={{ fill: culprit ? '#ff7a6e' : '#86d9ff' }} transition={{ duration: 0.3 }}>
              C29
            </motion.text>
          </g>

          {culprit && !reduce && (
            <motion.circle cx="227" cy="207" fill="none" stroke="#ff5247" strokeWidth="1.5" initial={{ r: 12, opacity: 0.7 }} animate={{ r: 28, opacity: 0 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} />
          )}

          {/* fault callout */}
          <motion.g initial={false} animate={{ opacity: culprit ? 1 : 0 }} transition={{ duration: 0.35 }}>
            <line x1="222" y1="214" x2="150" y2="245" stroke="#ff5247" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
            <circle cx="140" cy="248" r="10" fill="#0a120e" stroke="#ff5247" strokeWidth="1.3" />
            <text x="140" y="252" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" fill="#ff5247">1</text>
            <text x="80" y="270" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" fill="#ff7a6e">shorted to GND</text>
          </motion.g>

          {/* the proof: C29 lifts into its database row */}
          <motion.g initial={false} animate={{ opacity: proven ? 1 : 0, y: proven ? 0 : 10 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
            <line x1="234" y1="200" x2="392" y2="120" stroke="#39f0a3" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <rect x="392" y="74" width="236" height="150" rx="10" fill="#0a160f" stroke="#1f7a52" strokeWidth="1.3" />
            <text x="406" y="98" fontFamily="var(--font-mono)" fontSize="9" fill="#39f0a3" opacity="0.8">postgres › components</text>
            <line x1="406" y1="108" x2="614" y2="108" stroke="#1c3a2e" strokeWidth="1" />
            {[['refdes', 'C29'], ['type', 'capacitor'], ['net', 'PP5V0_SYS']].map(([k, v], i) => (
              <g key={k}>
                <text x="406" y={128 + i * 20} fontFamily="var(--font-mono)" fontSize="10" fill="#5fae93">{k}</text>
                <text x="500" y={128 + i * 20} fontFamily="var(--font-mono)" fontSize="10" fill="#bfeede">{v}</text>
              </g>
            ))}
            <line x1="406" y1="188" x2="614" y2="188" stroke="#1c3a2e" strokeWidth="1" />
            <circle cx="414" cy="206" r="7" fill="none" stroke="#39f0a3" strokeWidth="1.4" />
            <text x="414" y="209.5" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="#39f0a3">✓</text>
            <text x="428" y="210" fontFamily="var(--font-mono)" fontSize="9.5" fontWeight="600" fill="#39f0a3">verified · electrical_graph</text>
          </motion.g>
        </svg>
      </div>
    </div>
  )
}

/* ───────────────────── small section pieces ───────────────────── */

function BuyerCard({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-[13px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[18px] shadow-[0_1px_0_#fff8ec_inset,0_18px_36px_-28px_#00000055]">
      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-flux/30 bg-[#fff7e9] text-flux-ink">
        {icon}
      </div>
      <div className="ucl mt-[12px] text-[12px] text-ink">{title}</div>
      <p className="mt-[8px] font-sans text-[12.5px] leading-[1.55] text-ink-2s">{body}</p>
    </div>
  )
}

function Pillar({ n, title, body, last }: { n: string; title: string; body: string; last?: boolean }) {
  return (
    <div className="relative flex flex-col rounded-[13px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[16px] shadow-[0_1px_0_#fff8ec_inset]">
      <span className="font-mono text-[10px] font-semibold text-flux-ink">{n}</span>
      <div className="ucl mt-[8px] text-[11px] text-ink">{title}</div>
      <p className="mt-[8px] font-sans text-[12px] leading-[1.5] text-ink-2s">{body}</p>
      {!last && (
        <span aria-hidden className="absolute right-[-13px] top-1/2 hidden -translate-y-1/2 font-mono text-[14px] text-rule-strong md:block">
          →
        </span>
      )}
    </div>
  )
}

function StatItem({ k, v, border }: { k: string; v: string; border?: boolean }) {
  return (
    <div className={`px-[18px] py-[18px] ${border ? 'border-l border-rule' : ''}`}>
      <div className="font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-flux-ink">{k}</div>
      <div className="mt-[7px] font-mono text-[9.5px] leading-[1.4] text-ink-3">{v}</div>
    </div>
  )
}

/* ───────────────────────── page ───────────────────────── */

export function Landing({ topCause }: { topCause: FleetSummary | null }) {
  const reduce = useReducedMotion()
  const pct = topCause ? Math.round(topCause.pct) : 58
  const refdes = topCause?.refdes ?? 'C29'
  const repairs = topCause?.totalRepairs ?? 12

  const heroRise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: 'easeOut' } }

  return (
    <main className="px-5 pb-20 pt-5 md:px-8">
      <div className="mx-auto max-w-[1180px]">
        {/* top bar */}
        <header className="flex items-center gap-3">
          <Logo />
          <div>
            <div className="font-display text-[15px] font-bold leading-none tracking-[-0.01em]">
              CONTI<span className="text-flux">NUITY</span>
            </div>
            <div className="mt-[3px] font-mono text-[8px] tracking-[0.18em] text-ink-3">BENCH&nbsp;DIAGNOSTIC&nbsp;INSTRUMENT</div>
          </div>
          <Link href="/pricing" className="ml-auto font-mono text-[11px] text-ink-2s transition-colors hover:text-ink">
            Pricing
          </Link>
          <Link href="/sign-up" className="rounded-full border border-flux bg-flux px-[16px] py-[8px] font-mono text-[11px] font-semibold text-[#fff7e9] shadow-[0_8px_20px_-10px_var(--flux)] transition-transform hover:-translate-y-[1px]">
            Create your shop&nbsp;→
          </Link>
        </header>

        {/* hero */}
        <section className="mt-12 grid items-center gap-10 md:mt-16 md:grid-cols-[1.02fr_0.98fr] md:gap-12">
          <motion.div {...heroRise(0.02)}>
            <span className="ucl text-[11px] text-flux-ink">Component-level repair · grounded in a real graph</span>
            <h1 className="mt-[14px] font-display text-[40px] font-bold leading-[1.02] tracking-[-0.02em] text-ink md:text-[54px]">
              Diagnose boards like your <span className="text-flux">best tech.</span>
            </h1>
            <p className="mt-[18px] max-w-[32rem] font-sans text-[15px] leading-[1.6] text-ink-2s">
              Continuity takes a dead board from symptom to the one bad component — and shows your tech the exact
              pin to probe. Every part it names is a real, verified row in the schematic, so even a first-week tech
              can trust the call. No swap-and-pray; no scrapping boards you could have saved.
            </p>
            <div className="mt-[16px] flex items-center gap-2 font-mono text-[11px] text-ink-3">
              <span className="h-[6px] w-[6px] flex-none rounded-full bg-flux" />
              It can&rsquo;t invent a part: every refdes resolves to a row, or it says &ldquo;no such part.&rdquo;
            </div>
            <div className="mt-[24px] flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className="rounded-full border border-flux bg-flux px-[20px] py-[11px] font-mono text-[12px] font-semibold text-[#fff7e9] shadow-[0_10px_26px_-12px_var(--flux)] transition-transform hover:-translate-y-[1px]">
                Create your shop&nbsp;→
              </Link>
              <Link href="/bench" className="rounded-full border border-rule-2 bg-[#fff7e9] px-[20px] py-[11px] font-mono text-[12px] text-ink-2s transition-colors hover:border-rule-strong">
                Explore the live demo&nbsp;→
              </Link>
            </div>
            <div className="mt-[22px] flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.02em] text-ink-3">
              <span>Aurora PostgreSQL + pgvector</span>
              <span className="text-rule-strong">·</span>
              <span>tenant-scoped multi-shop</span>
              <span className="text-rule-strong">·</span>
              <span>right-to-repair ready</span>
            </div>
          </motion.div>

          <motion.div {...heroRise(0.18)}>
            <BoardProof />
          </motion.div>
        </section>

        {/* 01 — the problem */}
        <Reveal className="mt-24 md:mt-28">
          <SectionLabel n="01">The problem</SectionLabel>
          <div className="mt-6 grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <h2 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-[38px]">
                Repairable boards get thrown away.
              </h2>
              <p className="mt-[16px] max-w-[34rem] font-sans text-[14.5px] leading-[1.6] text-ink-2s">
                Board-level faults are where repair gets hard — and where most shops give up. Diagnosis lives in a few
                senior techs&rsquo; heads; juniors swap parts on a hunch; and the documentation that exists is buried in
                PDFs, a dozen incompatible boardview formats, and forum threads that end with &ldquo;did you ever fix
                it?&rdquo; So good boards get scrapped.
              </p>
            </div>
            <div className="rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] p-[20px] shadow-[0_1px_0_#fff8ec_inset,0_18px_36px_-28px_#00000055]">
              <div className="font-display text-[44px] font-bold leading-none tracking-[-0.03em] text-flux-ink">62&nbsp;Mt</div>
              <div className="mt-[8px] font-sans text-[13px] text-ink-2s">of electronics discarded every year — most of it repairable.</div>
              <div className="mt-[16px] flex h-[10px] overflow-hidden rounded-full">
                <div className="h-full bg-phos" style={{ width: '22%' }} />
                <div className="h-full bg-probe/70" style={{ width: '78%' }} />
              </div>
              <div className="mt-[7px] flex justify-between font-mono text-[9px] text-ink-3">
                <span>22% recycled</span>
                <span>78% lost</span>
              </div>
              <div className="mt-[14px] border-t border-dashed border-rule pt-[10px] font-mono text-[9px] leading-[1.5] text-ink-3">
                UN Global E-waste Monitor · right-to-repair laws now require the opposite.
              </div>
            </div>
          </div>
        </Reveal>

        {/* 02 — who it's for */}
        <Reveal className="mt-24 md:mt-28">
          <SectionLabel n="02">Who it&rsquo;s for</SectionLabel>
          <h2 className="mt-6 max-w-[40rem] font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-[38px]">
            Built for the businesses that fix boards at volume.
          </h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <BuyerCard
              title="Refurbishers & ITAD"
              body="Turn scrap into stock. Every board you diagnose instead of discard is recovered resale value — hard-dollar ROI."
              icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l7-4 7 4-7 4-7-4z" strokeLinejoin="round" /><path d="M3 7v6l7 4 7-4V7" strokeLinejoin="round" /><path d="M10 11v6" /></svg>}
            />
            <BuyerCard
              title="Repair shops & networks"
              body="Your whole bench works at senior level — and you stop losing capability the day a tech walks out the door."
              icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12.5 3.5a3 3 0 00-4 4l-5 5 2.5 2.5 5-5a3 3 0 004-4l-2 2-1.5-1.5 2-2z" strokeLinejoin="round" /></svg>}
            />
            <BuyerCard
              title="OEM & service depots"
              body="One consistent, auditable diagnosis across every technician and every site — not thirty different judgment calls."
              icon={<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="1.5" /><path d="M7 7h6M7 10h6M7 13h3" strokeLinecap="round" /></svg>}
            />
          </div>
        </Reveal>

        {/* 03 — how it works */}
        <Reveal className="mt-24 md:mt-28">
          <SectionLabel n="03">How it works</SectionLabel>
          <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-[34rem] font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-[38px]">
              An instrument, not a chatbot.
            </h2>
            <p className="font-mono text-[11px] text-ink-3">Four steps — the database carries every one.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            <Pillar n="01" title="Ingest" body="The board becomes a graph: components, nets, pins, and connections, stored as rows in Aurora — not a flattened PDF." />
            <Pillar n="02" title="Diagnose" body="A recursive trace walks the real power path from the symptom to the suspect part." />
            <Pillar n="03" title="Ground" body="Every refdes the agent names resolves to a row, or it returns “no such part.” It cannot hallucinate one." />
            <Pillar n="04" title="Verify & learn" body="A deterministic checker re-runs each finding against the schematic; the fleet’s repairs become “which part fails, how often” — with no shop’s data exposed." last />
          </div>
        </Reveal>

        {/* 04 — the proof */}
        <Reveal className="mt-24 md:mt-28">
          <SectionLabel n="04">The proof</SectionLabel>
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
            <div>
              <h2 className="font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ink md:text-[38px]">
                Don&rsquo;t take the model&rsquo;s word for it.
              </h2>
              <p className="mt-[16px] max-w-[32rem] font-sans text-[14.5px] leading-[1.6] text-ink-2s">
                Open it yourself. The knowledge graph is rendered live from the database, and every diagnosis writes a
                verified, auditable record you can re-check against the schematic.
              </p>
              <div className="mt-[20px] flex flex-wrap gap-3">
                <Link href="/graph" className="rounded-full border border-flux bg-flux px-[18px] py-[10px] font-mono text-[12px] font-semibold text-[#fff7e9] transition-transform hover:-translate-y-[1px]">
                  See the live graph&nbsp;→
                </Link>
                <Link href="/bench" className="rounded-full border border-rule-2 bg-[#fff7e9] px-[18px] py-[10px] font-mono text-[12px] text-ink-2s transition-colors hover:border-rule-strong">
                  Open the bench
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 overflow-hidden rounded-[14px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset]">
              <StatItem k={`${pct}%`} v="of these faults trace to one part" />
              <StatItem k={`${repairs}`} v="confirmed repairs across the fleet" border />
              <StatItem k="1024-d" v="part embeddings in pgvector" />
              <StatItem k="0" v="parts it can invent" border />
            </div>
          </div>
        </Reveal>

        {/* 05 — cta */}
        <Reveal className="mt-24 md:mt-28">
          <div className="overflow-hidden rounded-[18px] border border-rule-2 bg-[linear-gradient(180deg,#f1ece0,#e7e1d3)] p-[34px] text-center shadow-[0_1px_0_#fff8ec_inset,0_30px_60px_-40px_#00000066] md:p-[44px]">
            <h2 className="mx-auto max-w-[28rem] font-display text-[30px] font-bold leading-[1.06] tracking-[-0.02em] text-ink md:text-[40px]">
              Stop scrapping boards you could fix.
            </h2>
            <p className="mx-auto mt-[14px] max-w-[30rem] font-sans text-[14px] leading-[1.55] text-ink-2s">
              Create your shop and run a diagnosis — grounded in the graph, verified by the database, and entirely yours.
            </p>
            <div className="mt-[24px] flex flex-wrap justify-center gap-3">
              <Link href="/sign-up" className="rounded-full border border-flux bg-flux px-[24px] py-[12px] font-mono text-[12px] font-semibold text-[#fff7e9] shadow-[0_12px_28px_-12px_var(--flux)] transition-transform hover:-translate-y-[1px]">
                Create your shop&nbsp;→
              </Link>
              <Link href="/bench" className="rounded-full border border-rule-2 bg-[#fff7e9] px-[24px] py-[12px] font-mono text-[12px] text-ink-2s transition-colors hover:border-rule-strong">
                Explore the live demo&nbsp;→
              </Link>
            </div>
          </div>
        </Reveal>

        {/* footer */}
        <footer className="mt-16 flex flex-col items-center gap-2 border-t border-rule pt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[10px] tracking-[0.06em] text-ink-3">
            <span>Aurora PostgreSQL + pgvector</span>
            <span className="text-rule-strong">·</span>
            <span>tenant-scoped multi-shop</span>
            <span className="text-rule-strong">·</span>
            <span>Next.js on Vercel</span>
          </div>
          <div className="font-mono text-[10px] text-flux-ink">Built for the right-to-repair movement.</div>
        </footer>
      </div>
    </main>
  )
}
