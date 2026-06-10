// Typed mock data for the Continuity diagnostic instrument.
// ROWS = provenance map (database rows), STEPS = scripted diagnostic sequence.

export type RowKind = 'comp' | 'net'

export interface ProvenanceRow {
  kind: RowKind
  rd: string
  src: string
  grid: [string, string][]
  conf: string
}

// Provenance map — the "database rows" behind each citation chip.
export const ROWS: Record<string, ProvenanceRow> = {
  U7: {
    kind: 'comp',
    rd: 'U7',
    src: 'boardview · p.7',
    grid: [
      ['type', 'IC · buck regulator'],
      ['value', 'TPS62840'],
      ['package', 'WSON-8'],
      ['net', 'PP5V0_SYS'],
      ['pins', '8'],
    ],
    conf: '0.98',
  },
  C29: {
    kind: 'comp',
    rd: 'C29',
    src: 'boardview · p.7',
    grid: [
      ['type', 'capacitor'],
      ['value', '10 µF'],
      ['package', '0402 · X5R'],
      ['net', 'PP5V0_SYS ↔ GND'],
      ['role', 'input decoupling'],
    ],
    conf: '0.95',
  },
  J15: {
    kind: 'comp',
    rd: 'J15',
    src: 'boardview · p.2',
    grid: [
      ['type', 'connector · USB-C'],
      ['value', 'TYPE-C 16P'],
      ['package', 'recept SMT'],
      ['net', 'VBUS → PP5V0'],
      ['pins', '16'],
    ],
    conf: '0.99',
  },
  PP5V0: {
    kind: 'net',
    rd: 'PP5V0_SYS',
    src: 'electrical graph',
    grid: [
      ['class', 'power rail'],
      ['source', 'U7 pin 5'],
      ['members', '37 pins'],
      ['sinks', 'U1, U12, J9'],
      ['nominal', '5.00 V'],
    ],
    conf: '0.97',
  },
}

// ---- Console content segments ----
export type ChipKind = 'cite' | 'net' | 'sym' | 'act' | 'bal'

export interface ChipSegment {
  t: 'chip'
  kind: ChipKind
  label: string
  prov?: keyof typeof ROWS
}
export interface TextSegment {
  t: 'text'
  text: string
}
export type Segment = TextSegment | ChipSegment

const text = (s: string): TextSegment => ({ t: 'text', text: s })
const chip = (kind: ChipKind, label: string, prov?: keyof typeof ROWS): ChipSegment => ({
  t: 'chip',
  kind,
  label,
  prov,
})
const bal = (n: string): ChipSegment => ({ t: 'chip', kind: 'bal', label: n })

// ---- Side effects each step applies to the instrument ----
export interface StepEffects {
  busy?: boolean
  lit?: string[]
  fault?: string[]
  drawTrace?: boolean
  callouts?: string[]
  meter?: number
  faultLed?: boolean
  cursorV?: string
}

export type StepKind = 'user' | 'trace' | 'measure' | 'cause' | 'fix'

export interface Step {
  k: StepKind
  label: string
  when: string
  delay: number
  think?: number
  fix?: boolean
  content: Segment[]
  fixSteps?: Segment[][]
  effects?: StepEffects
}

export const STEPS: Step[] = [
  {
    k: 'user',
    label: 'TECH',
    when: '14:22',
    delay: 300,
    content: [
      text("MNT Reform won't power on. The green LED flickers once on USB-C, then nothing."),
    ],
  },
  {
    k: 'trace',
    label: 'TRACE',
    when: '14:22',
    delay: 1000,
    think: 1300,
    content: [
      text(
        'A single flicker then dead means a rail is collapsing under load. Starting at the primary rails and walking back to the source.',
      ),
    ],
    effects: { busy: true },
  },
  {
    k: 'trace',
    label: 'TRACE',
    when: '14:23',
    delay: 1300,
    think: 1500,
    content: [
      chip('net', 'PP5V0_SYS', 'PP5V0'),
      text(' reads '),
      chip('sym', '0.31 V'),
      text(' instead of 5 V. Its regulator is '),
      chip('cite', 'U7', 'U7'),
      bal('1'),
      text(' — tracing the rail from '),
      chip('cite', 'J15', 'J15'),
      text(' now.'),
    ],
    effects: {
      lit: ['c_U7', 'c_J15'],
      drawTrace: true,
      callouts: ['cal1'],
      meter: 0.31,
      cursorV: '0.31 V',
    },
  },
  {
    k: 'measure',
    label: 'MEASURE',
    when: '14:24',
    delay: 1900,
    think: 1400,
    content: [
      text('Short is local to U7. '),
      chip('cite', 'C29', 'C29'),
      bal('2'),
      text(' — the input decoupling cap — reads '),
      chip('sym', '3.9 Ω'),
      text(
        " pad-to-pad. That's a dead short pulling the whole 5 V rail down.",
      ),
    ],
    effects: { fault: ['c_C29'], callouts: ['cal2'], faultLed: true },
  },
  {
    k: 'cause',
    label: 'CAUSE',
    when: '14:24',
    delay: 1500,
    think: 1100,
    content: [
      text('Root cause confirmed: shorted '),
      chip('cite', 'C29', 'C29'),
      text(' on '),
      chip('net', 'PP5V0_SYS', 'PP5V0'),
      bal('3'),
      text('.'),
    ],
    effects: { callouts: ['cal3'] },
  },
  {
    k: 'fix',
    label: 'FIX',
    when: '14:25',
    delay: 1300,
    think: 900,
    fix: true,
    content: [text('Repair protocol —')],
    fixSteps: [
      [
        { t: 'text', text: 'Remove ' },
        chip('cite', 'C29', 'C29'),
        text(', re-check pad-to-GND — confirm the short clears.'),
      ],
      [
        { t: 'text', text: 'Replace ' },
        text('10 µF 0402 X5R '),
        chip('act', 'stock · donor B3 ×4'),
        text('.'),
      ],
      [
        { t: 'text', text: 'Re-power ' },
        text('at 500 mA limit; watch '),
        chip('net', 'PP5V0_SYS', 'PP5V0'),
        text(' settle to 5 V.'),
      ],
    ],
  },
]

// Power rails shown in the left module.
export interface Rail {
  state: 'ok' | 'warn' | 'dead'
  name: string
  value: string
}

export const RAILS: Rail[] = [
  { state: 'dead', name: 'PP5V0_SYS', value: '0.31' },
  { state: 'warn', name: 'PP3V3_SYS', value: '2.90' },
  { state: 'ok', name: 'PP1V8', value: '1.80' },
  { state: 'ok', name: 'VBAT', value: '12.1' },
]
