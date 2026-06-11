// Client-side helpers for consuming the /api/diagnose UI message stream and
// turning model text into the same chip-annotated console segments the scripted
// STEPS use. No UI/token changes — we only build existing Segment[] shapes.

import type { Segment, StepKind } from './continuity-data'

// ---- SSE parsing (the route returns createUIMessageStreamResponse, SSE) -----
export interface StreamChunk {
  type: string
  // text-delta
  delta?: string
  // custom data parts: { type: 'data-xxx', data: {...} }
  data?: Record<string, unknown>
  [k: string]: unknown
}

export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamChunk> {
  if (!response.body) throw new Error('No response body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        yield JSON.parse(payload) as StreamChunk
      } catch {
        /* skip keep-alives / partial frames */
      }
    }
  }
}

// ---- phase tag -> console step kind -----------------------------------------
const PHASE_KIND: Record<string, StepKind> = {
  TRACE: 'trace',
  MEASURE: 'measure',
  CAUSE: 'cause',
  FIX: 'fix',
}

export function phaseFromText(text: string): { kind: StepKind; label: string; body: string } {
  const m = text.match(/^\s*\[([A-Z]+)\]\s*/)
  if (m && PHASE_KIND[m[1]]) {
    return { kind: PHASE_KIND[m[1]], label: m[1], body: text.slice(m[0].length) }
  }
  return { kind: 'trace', label: 'NOTE', body: text.trim() }
}

// ---- turn plain model text into chip-annotated Segment[] --------------------
// Known nets (collected from stream events) render as green net chips; tokens
// that look like reference designators render as blue citation chips. Both use
// the token itself as the provenance key, which app/actions.getProvenance
// resolves live against Aurora.
const REFDES_RE = /\b[A-Z]{1,3}\d{1,4}\b/g

export function segmentize(text: string, knownNets: Set<string>): Segment[] {
  const segments: Segment[] = []
  // Build a combined matcher: nets first (longer, explicit), then refdes.
  const netList = [...knownNets].filter(Boolean).sort((a, b) => b.length - a.length)
  const netAlt = netList.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const combined = new RegExp(
    `(${netAlt ? netAlt + '|' : ''}${REFDES_RE.source})`,
    'g',
  )

  let last = 0
  let match: RegExpExecArray | null
  while ((match = combined.exec(text)) !== null) {
    const token = match[0]
    if (match.index > last) {
      segments.push({ t: 'text', text: text.slice(last, match.index) })
    }
    const isNet = knownNets.has(token)
    segments.push({
      t: 'chip',
      kind: isNet ? 'net' : 'cite',
      label: token,
      // prov key is the raw token; getProvenance resolves it live.
      prov: token as never,
    })
    last = match.index + token.length
  }
  if (last < text.length) segments.push({ t: 'text', text: text.slice(last) })
  if (segments.length === 0) segments.push({ t: 'text', text })
  return segments
}

export function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
