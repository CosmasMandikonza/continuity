'use client'

import { motion } from 'framer-motion'
import type { InstrumentState } from './use-diagnostic-sequence'

interface BoardScreenProps {
  state: InstrumentState
}

// Total length of the trace path, used for the draw-on animation.
const TRACE_D = 'M170 510 L170 390 L300 390 L300 270 L520 270 L520 214 L600 214'
const TRACE_LEN = 560

function cls(base: string, lit: boolean, fault: boolean) {
  return `comp${lit ? ' lit' : ''}${fault ? ' fault' : ''} ${base}`
}

function Callout({
  id,
  state,
  fault,
  x,
  y,
  lead,
  num,
}: {
  id: string
  state: InstrumentState
  fault?: boolean
  x: number
  y: number
  lead: [number, number, number, number]
  num: string
}) {
  const show = state.callouts.has(id)
  const ring = fault ? 'var(--probe)' : 'var(--phos)'
  return (
    <motion.g
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      <line
        x1={lead[0]}
        y1={lead[1]}
        x2={lead[2]}
        y2={lead[3]}
        stroke="#6f5"
        strokeWidth={1}
        strokeDasharray="2 2"
        opacity={0.7}
      />
      <circle cx={x} cy={y} r={13} fill="#0c130f" stroke={ring} strokeWidth={1.4} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-mono)"
        fontSize={10}
        fontWeight={600}
        fill={ring}
      >
        {num}
      </text>
    </motion.g>
  )
}

export function BoardScreen({ state }: BoardScreenProps) {
  return (
    <div className="relative min-h-0 flex-1">
      <div
        className="absolute inset-0 overflow-hidden rounded-[11px] border border-[#05140f]"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 0%, #11160f 0%, var(--screen) 70%)',
          boxShadow:
            '0 0 0 6px #d9d2c1, 0 0 0 7px #b9af98, 0 22px 40px -18px #000000aa inset, 0 0 60px -10px #0c3a2c inset',
        }}
      >
        <svg
          viewBox="0 0 1000 680"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label="Board view: PP5V0_SYS rail traced from J15 USB-C through buck regulator U7 to a shorted decoupling capacitor C29"
        >
          <defs>
            <pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="#0f3328" strokeWidth="1" />
            </pattern>
            <filter id="phos" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="gC" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="gR" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x="0" y="0" width="1000" height="680" fill="url(#g)" opacity=".55" />

          {/* edge rulers */}
          <g stroke="#1c5444" strokeWidth="1" opacity=".8">
            <path d="M70 26h860" />
            <path d="M70 22v8M210 22v6M350 22v8M490 22v6M630 22v8M770 22v6M910 22v8" />
            <path d="M40 70v540" />
            <path d="M36 70h8M36 190h6M36 310h8M36 430h6M36 550h8" />
          </g>
          <g
            fontFamily="var(--font-mono)"
            fontSize="8"
            fill="#356d5b"
            letterSpacing=".1em"
          >
            <text x="70" y="16">
              0
            </text>
            <text x="346" y="16">
              40
            </text>
            <text x="626" y="16">
              80
            </text>
            <text x="900" y="16">
              120 mm
            </text>
          </g>

          {/* registration / crop marks */}
          <g stroke="#2a6b58" strokeWidth="1.4">
            <path d="M70 52v14M70 52h14" />
            <path d="M930 52v14M930 52h-14" />
            <path d="M70 628v-14M70 628h14" />
            <path d="M930 628v-14M930 628h-14" />
          </g>

          {/* substrate */}
          <rect
            x="92"
            y="74"
            width="816"
            height="532"
            rx="12"
            fill="#0a1f18"
            stroke="#19463a"
            strokeWidth="1.4"
          />
          <g
            stroke="#163d31"
            strokeWidth="1.2"
            fill="none"
            opacity=".85"
            strokeLinecap="round"
          >
            <path d="M180 200h140M340 170v60h150M560 150h150v90M650 400h140M280 470h180v-44M520 510h200" />
            <path d="M210 330h100v96M760 280v130h-90" />
          </g>

          {/* animated PP5V0 trace: J15 -> U7 */}
          <motion.path
            className="trace-path"
            d={TRACE_D}
            fill="none"
            strokeDasharray={TRACE_LEN}
            initial={false}
            animate={{
              strokeDashoffset: state.traceDrawn ? 0 : TRACE_LEN,
              opacity: state.traceDrawn ? 1 : 0,
            }}
            transition={{
              strokeDashoffset: { duration: 1.15, ease: 'easeInOut' },
              opacity: { duration: 0.3 },
            }}
          />

          {/* U1 PMIC */}
          <g className="comp" transform="translate(330,318)">
            <rect
              className="bdy"
              x="0"
              y="0"
              width="172"
              height="138"
              rx="6"
              fill="#102b22"
              stroke="#234f41"
              strokeWidth="1.2"
            />
            <rect
              x="11"
              y="11"
              width="150"
              height="116"
              rx="3"
              fill="#0b211a"
              stroke="#163d31"
            />
            <g stroke="#2c5e4d" strokeWidth="2">
              <path d="M0 28h-10M0 52h-10M0 76h-10M0 100h-10" />
              <path d="M172 28h10M172 52h10M172 76h10M172 100h10" />
              <path d="M30 0v-10M66 0v-10M102 0v-10M138 0v-10" />
              <path d="M30 138v10M66 138v10M102 138v10M138 138v10" />
            </g>
            <text
              className="rd"
              x="86"
              y="66"
              textAnchor="middle"
              style={{ fontSize: '13px', fontWeight: 600 }}
            >
              U1
            </text>
            <text className="rd" x="86" y="80" textAnchor="middle" style={{ fontSize: '8px' }}>
              PMIC · BD718
            </text>
          </g>

          {/* U7 buck reg */}
          <g
            className={cls('', state.lit.has('c_U7'), state.fault.has('c_U7'))}
            transform="translate(600,178)"
          >
            <rect
              className="bdy"
              x="0"
              y="0"
              width="80"
              height="62"
              rx="5"
              fill="#102b22"
              stroke="#234f41"
              strokeWidth="1.2"
            />
            <g stroke="#2c5e4d" strokeWidth="2">
              <path d="M0 18h-9M0 44h-9M80 18h9M80 44h9M22 0v-9M58 0v-9M22 62v9M58 62v9" />
            </g>
            <text
              className="rd"
              x="40"
              y="28"
              textAnchor="middle"
              style={{ fontSize: '11px', fontWeight: 600 }}
            >
              U7
            </text>
            <text className="rd" x="40" y="40" textAnchor="middle" style={{ fontSize: '7px' }}>
              BUCK 5V
            </text>
          </g>

          {/* C29 (culprit) */}
          <g
            className={cls('', state.lit.has('c_C29'), state.fault.has('c_C29'))}
            transform="translate(548,214)"
          >
            <rect
              className="bdy"
              x="0"
              y="0"
              width="24"
              height="14"
              rx="2.5"
              fill="#123227"
              stroke="#234f41"
              strokeWidth="1.1"
            />
            <text className="rd" x="12" y="-5" textAnchor="middle">
              C29
            </text>
          </g>

          {/* C31 */}
          <g className="comp" transform="translate(708,196)">
            <rect
              className="bdy"
              x="0"
              y="0"
              width="24"
              height="14"
              rx="2.5"
              fill="#123227"
              stroke="#234f41"
              strokeWidth="1.1"
            />
            <text className="rd" x="12" y="-5" textAnchor="middle">
              C31
            </text>
          </g>

          {/* R42 */}
          <g className="comp" transform="translate(516,332)">
            <rect
              className="bdy"
              x="0"
              y="0"
              width="28"
              height="13"
              rx="2"
              fill="#143729"
              stroke="#234f41"
              strokeWidth="1.1"
            />
            <text className="rd" x="14" y="-5" textAnchor="middle">
              R42
            </text>
          </g>

          {/* J15 USB-C */}
          <g
            className={cls('', state.lit.has('c_J15'), state.fault.has('c_J15'))}
            transform="translate(126,500)"
          >
            <rect
              className="bdy"
              x="0"
              y="0"
              width="88"
              height="64"
              rx="6"
              fill="#0f2a21"
              stroke="#234f41"
              strokeWidth="1.2"
            />
            <rect
              x="16"
              y="16"
              width="56"
              height="32"
              rx="14"
              fill="#0a201a"
              stroke="#163d31"
            />
            <text className="rd" x="44" y="58" textAnchor="middle">
              J15 · USB-C
            </text>
          </g>

          {/* TP12 */}
          <g className="comp" transform="translate(620,330)">
            <circle
              className="bdy"
              cx="0"
              cy="0"
              r="8"
              fill="#0b211a"
              stroke="#234f41"
              strokeWidth="1.4"
            />
            <circle cx="0" cy="0" r="2.6" fill="#2c5e4d" />
            <text className="rd" x="0" y="-14" textAnchor="middle">
              TP12
            </text>
          </g>

          {/* CALLOUTS (engineering balloons) */}
          <Callout
            id="cal1"
            state={state}
            x={700}
            y={140}
            lead={[688, 150, 660, 180]}
            num="1"
          />
          <Callout
            id="cal2"
            state={state}
            fault
            x={528}
            y={180}
            lead={[540, 190, 558, 212]}
            num="2"
          />
          <Callout
            id="cal3"
            state={state}
            x={300}
            y={318}
            lead={[300, 330, 300, 390]}
            num="3"
          />
        </svg>

        {/* overlays */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay"
          style={{
            background:
              'repeating-linear-gradient(0deg, #ffffff08 0 1px, #00000000 1px 3px)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 120% at 50% 45%, #00000000 55%, #000a07 100%)',
          }}
        />
        <div className="pointer-events-none absolute bottom-[10px] left-3 font-mono text-[8.5px] tracking-[0.13em] text-[#3f6b5c]">
          SCALE&nbsp;<b className="text-[#5fae8f]">4:1</b> · LAYER&nbsp;
          <b className="text-[#5fae8f]">TOP</b> ·{' '}
          <b className="text-[#5fae8f]">{state.cursorV}</b>
        </div>
        <div className="pointer-events-none absolute bottom-[10px] right-3 font-mono text-[8.5px] tracking-[0.13em] text-[#3f6b5c]">
          REFDES&nbsp;<b className="text-[#5fae8f]">1482</b> · NETS&nbsp;
          <b className="text-[#5fae8f]">914</b>
        </div>
      </div>
    </div>
  )
}
