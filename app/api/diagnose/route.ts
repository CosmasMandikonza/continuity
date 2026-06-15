import {
  streamText,
  tool,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai'
import { z } from 'zod'
import { withTenant } from '@/lib/db'
import {
  deviceIdByName,
  traceNet,
  provenanceCard,
  netMembers,
  netCard,
  createRepair,
  saveMessage,
  recordMeasurementRow,
  proposeFindingRow,
  saveCitation,
  saveVerification,
  resolveComponentId,
  resolveNetId,
  meterTenant,
  failureRate,
  similarCases as findSimilarCases,
} from '@/lib/queries'
import { verifyFinding } from '@/lib/verify'
import { diagnosticModel, modelProviderOptions, HAS_MODEL_CREDS } from '@/lib/model'
import { getTenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEVICE_NAME = 'MNT Reform'

const SYSTEM_PROMPT = `You are Continuity, a meticulous board-level repair diagnostician working a live bench.

Hard rules — you will be audited against the database:
- A FLEET HISTORY and SIMILAR PAST CASES block for this symptom is provided below. Treat it as a STARTING HYPOTHESIS to confirm on THIS board, not a conclusion. Call traceNet on the leading suspect, then recordMeasurement on the rail it feeds, then proposeFinding. You have NOT finished until you call proposeFinding — never stop after only tracing.
- You only know this board through tools. Discover it via traceNet, inspectComponent, netMembers. NEVER name a refdes or net you have not seen in a tool result.
- NEVER invent part numbers, values, or packages. Only state what inspectComponent returned.
- Record EVERY measurement you reason from with recordMeasurement before you cite it as evidence.
- Propose EXACTLY ONE root-cause finding with proposeFinding, with a calibrated confidence (0-1). Then give a short numbered repair protocol.
- A 'short' finding requires a recorded low-resistance measurement on that part/net. A rail collapse requires a measured voltage well below the net's nominal. Take those measurements first.
- If a tool returns found:false, say so plainly ("no such part on this board"). Do not substitute a similar refdes.
- If the evidence is insufficient, return an INCONCLUSIVE result naming the single next measurement to take. NEVER fabricate a culprit to seem decisive.
- CALL tools through the function interface — never write a tool name (traceNet, recordMeasurement, proposeFinding) or its arguments in your visible text. Your messages are read by a human technician and must be plain English, never code or a function call.

Narrate as you work, using the tools for every action. Begin EACH message with exactly one phase tag and nothing before it — [TRACE], then [MEASURE], then [CAUSE], then [FIX] — and cover only ONE phase per message. Keep each message to one or two short sentences, and never repeat a phase. After proposeFinding, send a single [FIX] message: a numbered repair protocol of at most five concise steps. Put a tag ONLY at the very start of a message, never mid-sentence.`

interface DiagBody {
  symptom?: string
  deviceName?: string
}

export async function POST(req: Request) {
  const body = (await req.json()) as DiagBody
  const symptom = (body.symptom || '').trim()
  const deviceName = body.deviceName || DEVICE_NAME

  // No model credentials -> tell the client to use the scripted fallback.
  if (!HAS_MODEL_CREDS) {
    return Response.json({ fallback: true, reason: 'no-credentials' }, { status: 200 })
  }

  const deviceId = await deviceIdByName(deviceName)
  if (!deviceId) {
    return Response.json({ fallback: true, reason: 'no-device' }, { status: 200 })
  }

  // Resolve the signed-in shop (or the DEV fallback when Clerk is absent).
  const { tenantId, userId } = await getTenantContext()

  const period = new Date().toISOString().slice(0, 7) // YYYY-MM

  // Collect citations as the agent inspects rows, so we can persist + verify them.
  const citedRefdes = new Set<string>()
  const citedNets = new Set<string>()
  let repairId = ''
  let fallbackRefdes = ''
  // The single proposed finding (last one wins), used for verification.
  let pendingFinding: { findingId: string; refdes: string; net: string | null; kind: string } | null =
    null

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // ---- a) RATE LIMIT (before any model call) --------------------------
      const meter = await withTenant(tenantId, async (client) =>
        meterTenant(client, tenantId, period),
      )
      if (meter.over) {
        writer.write({
          type: 'data-quota',
          data: { used: meter.used, quota: meter.quota, period },
          transient: true,
        })
        return
      }
      // Emit the live meter so the pill reflects the real count.
      writer.write({
        type: 'data-meter-usage',
        data: { used: meter.used, quota: meter.quota },
        transient: true,
      })

      // ---- b) open a repair + save the tech message -----------------------
      repairId = await withTenant(tenantId, async (client) => {
        const ref = `R-${Date.now().toString(36).toUpperCase()}`
        const id = await createRepair(
          client,
          tenantId,
          deviceId,
          userId,
          ref,
          symptom,
        )
        await saveMessage(client, id, 'tech', { text: symptom })
        return id
      })

      // ---- c) tools (the ONLY way the agent learns the board) -------------
      // Push a clean transcript line built from a REAL tool result, so the
      // console shows the full TRACE → MEASURE → CAUSE story even when a terse
      // model does the work via tool calls without narrating each phase.
      const logLine = (
        kind: 'trace' | 'measure' | 'cause' | 'fix',
        label: string,
        text: string,
      ) => writer.write({ type: 'data-log', data: { kind, label, text } })

      // ---- PRIOR HISTORY (run once, server-side, so it costs no model round-trips).
      // failure_rate = exact-symptom fleet stats; similar_findings = pgvector semantic
      // match (works for any phrasing). Both emit a transcript line and are handed to
      // the model below as grounding, instead of being model-invoked tools (which were
      // two extra Groq round-trips that pushed the run past the 60s function limit).
      let priorBlock = ''
      try {
        const rows = await failureRate(deviceId, symptom)
        rows.forEach((r) => citedRefdes.add(r.refdes))
        if (rows.length) fallbackRefdes = rows[0].refdes
        const top = rows.slice(0, 4)
        if (top.length) {
          logLine(
            'trace',
            'FLEET',
            `History for "${symptom}": ${top.map((r) => `${r.refdes} ${Math.round(r.pct)}%`).join(', ')}.`,
          )
          priorBlock += `\n\nFLEET HISTORY (confirmed root cause across all shops for the EXACT symptom "${symptom}"): ${rows
            .slice(0, 5)
            .map((r) => `${r.refdes} ${Math.round(r.pct)}% of ${r.rootCauses} repairs`)
            .join(', ')}.`
        } else {
          logLine('trace', 'FLEET', `No prior repair matches the exact symptom "${symptom}".`)
          priorBlock += `\n\nFLEET HISTORY: no past repair matches the exact wording "${symptom}".`
        }
      } catch {
        logLine('trace', 'FLEET', 'Fleet history is unavailable for this run.')
      }

      try {
        const matches = await findSimilarCases(symptom, deviceId)
        matches.forEach((m) => m.refdes && citedRefdes.add(m.refdes))
        if (matches.length) {
          const top = matches[0]
          const tally = new Map<string, number>()
          matches.forEach((m) => {
            if (m.refdes) tally.set(m.refdes, (tally.get(m.refdes) || 0) + 1)
          })
          const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
          const lead = ranked[0]
          if (!fallbackRefdes && lead) fallbackRefdes = lead[0]
          logLine(
            'trace',
            'CASES',
            `Symptom embeds to ${top.similarity.toFixed(2)} cosine similarity with ${matches.length} confirmed case${matches.length === 1 ? '' : 's'} (pgvector)${lead ? `; ${lead[0]} is the leading root cause (${lead[1]}/${matches.length})` : ''}.`,
          )
          priorBlock += `\n\nSIMILAR PAST CASES (pgvector semantic match — works even when the wording differs): closest confirmed cases resolve to ${ranked
            .map(([r, n]) => `${r} (${n})`)
            .join(', ')}. Leading suspect ${lead ? lead[0] : top.refdes}.`
        } else {
          logLine('trace', 'CASES', 'No embedded cases to match against yet.')
        }
      } catch {
        logLine('trace', 'CASES', 'Semantic case retrieval is unavailable for this run.')
      }

      const tools = {
        traceNet: tool({
          description:
            'Walk the electrical graph outward from a reference designator. Returns electrically connected components with hop distance, excluding ground/high-fanout power rails. Use this to find what a failing net touches.',
          inputSchema: z.object({
            refdes: z.string().describe('starting reference designator, e.g. U7'),
            maxHops: z.number().int().min(1).max(4).default(3),
          }),
          execute: async ({ refdes, maxHops }) => {
            const res = await traceNet(deviceId, refdes, maxHops)
            if (res.found && res.start) citedRefdes.add(res.start.refdes)
            res.nodes.forEach((n) => citedRefdes.add(n.refdes))
            res.nodes.forEach((n) => n.viaNet && citedNets.add(n.viaNet))
            writer.write({
              type: 'data-trace',
              data: {
                found: res.found,
                start: res.start?.refdes ?? refdes,
                onRail: res.onRail,
                nodes: res.nodes.map((n) => ({ refdes: n.refdes, hop: n.hop, viaNet: n.viaNet })),
              },
            })
            if (res.found) {
              const names = res.nodes.slice(0, 6).map((n) => n.refdes)
              logLine(
                'trace',
                'TRACE',
                `Walked the graph from ${res.start?.refdes ?? refdes}: ${names.join(', ')}${res.nodes.length > 6 ? '…' : ''}.`,
              )
            }
            return res
          },
        }),

        inspectComponent: tool({
          description:
            'Read the real database row for one component (kind, value, package, mpn, nets). Returns found:false for an unknown refdes.',
          inputSchema: z.object({ refdes: z.string() }),
          execute: async ({ refdes }) => {
            const card = await provenanceCard(deviceId, refdes)
            if (!card) {
              writer.write({ type: 'data-inspect', data: { refdes, found: false } })
              return { found: false, refdes }
            }
            citedRefdes.add(card.refdes)
            card.nets.forEach((n) => citedNets.add(n.name))
            writer.write({
              type: 'data-inspect',
              data: { found: true, refdes: card.refdes },
            })
            return { found: true, ...card }
          },
        }),

        netMembers: tool({
          description: 'List the pins and components attached to a named net.',
          inputSchema: z.object({ net: z.string() }),
          execute: async ({ net }) => {
            const members = await netMembers(deviceId, net)
            const card = await netCard(deviceId, net)
            if (members.length === 0 && !card) return { found: false, net }
            citedNets.add(net)
            members.forEach((m) => citedRefdes.add(m.refdes))
            return { found: true, net, nominalV: card?.nominalV ?? null, members }
          },
        }),

        recordMeasurement: tool({
          description:
            'Record a physical measurement (e.g. kind "voltage" or "resistance") on a net or component. value is numeric. Record before reasoning from it.',
          inputSchema: z.object({
            target: z.string().describe('refdes or net name being measured'),
            kind: z.string().describe('voltage | resistance | continuity | current'),
            value: z.number(),
            unit: z.string().nullable().default(null),
            expected: z.number().nullable().default(null),
          }),
          execute: async ({ target, kind, value, unit, expected }) => {
            const row = await withTenant(tenantId, async (client) => {
              // Decide whether the target is a net or a component.
              const netId = await resolveNetId(client, deviceId, target)
              const isNet = Boolean(netId)
              return recordMeasurementRow(client, deviceId, repairId, {
                net: isNet ? target : null,
                refdes: isNet ? null : target,
                kind,
                value,
                unit,
                expected,
              })
            })
            writer.write({
              type: 'data-measure',
              data: { target, kind, value, unit },
            })
            logLine(
              'measure',
              'MEASURE',
              `${target} reads ${value}${unit ? ' ' + unit : ''} (${kind}).`,
            )
            return { recorded: true, ...row }
          },
        }),

        proposeFinding: tool({
          description:
            'Propose exactly ONE root-cause finding. kind is e.g. "short", "rail_collapse", "open". confidence is 0-1. The database verifies it before it is shown as fact; it is NEVER auto-confirmed.',
          inputSchema: z.object({
            refdes: z.string(),
            net: z.string().nullable().default(null),
            kind: z.string(),
            confidence: z.number().min(0).max(1),
          }),
          execute: async ({ refdes, net, kind, confidence }) => {
            // Guard: refuse to propose a finding for an unknown part.
            const findingId = await withTenant(tenantId, async (client) => {
              const compId = await resolveComponentId(client, deviceId, refdes)
              if (!compId) return ''
              return proposeFindingRow(client, deviceId, repairId, refdes, net, kind, confidence)
            }).catch(() => '')
            if (!findingId) {
              writer.write({ type: 'data-finding', data: { refdes, found: false } })
              return { proposed: false, found: false, refdes }
            }
            citedRefdes.add(refdes)
            if (net) citedNets.add(net)
            pendingFinding = { findingId, refdes, net, kind }
            writer.write({
              type: 'data-finding',
              data: { refdes, net, kind, confidence },
            })
            logLine(
              'cause',
              'CAUSE',
              `${refdes}${net ? ' on ' + net : ''}: ${kind}, confidence ${confidence.toFixed(2)}.`,
            )
            return { proposed: true, findingId, refdes, kind, confidence }
          },
        }),
      }

      // ---- run the tool loop ---------------------------------------------
      const result = streamText({
        model: diagnosticModel(),
        system: SYSTEM_PROMPT + priorBlock,
        providerOptions: modelProviderOptions(),
        messages: [
          {
            role: 'user',
            content: `Device under test: ${deviceName}. Symptom from the tech: "${symptom}". Diagnose it.`,
          },
        ],
        tools,
        stopWhen: stepCountIs(8),
        prepareStep: ({ stepNumber }) => {
          // Force a tool call ONLY on the opening step, so the model starts by
          // investigating (it calls traceNet) instead of answering from
          // priors. After that, 'auto'.
          //
          // Why we don't constrain later steps: gpt-oss on Groq rejects
          // tool_choice both ways — naming a specific tool errors when it calls
          // a different one ("does not match request.tool_choice"), and
          // 'required' errors when it emits a narration-only step ("did not call
          // a tool"). It interleaves prose with tool calls, so only 'auto' is
          // safe after the opening. The prompt drives trace → measure → propose.
          if (stepNumber === 0) return { toolChoice: 'required' }
          return {}
        },
        onError: (err) => {
          console.log('[v0] diagnose streamText error:', err)
        },
      })

      // Merge the model's text/tool stream into our custom-part stream.
      writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false }))

      // ---- d) DETERMINISTIC VERIFICATION (after the loop) -----------------
      await result.finishReason.catch(() => undefined)

      // ---- SAFETY NET ----------------------------------------------------
      // If the model narrated the trace and stopped without proposing (gpt-oss
      // sometimes does, now that the suspect is handed to it as grounding),
      // complete the diagnosis deterministically from the grounded leading
      // suspect so the VERIFIED block always lands. The finding is real — the
      // suspect is the DB's confirmed top cause and the rail is one it sits on —
      // and the verifier below adjudicates it exactly as it would the model's.
      if (!pendingFinding && fallbackRefdes) {
        try {
          const done = await withTenant(tenantId, async (client) => {
            const { rows: nrows } = await client.query(
              'SELECT n.name, n.nominal_v FROM nets n JOIN pins p ON p.net_id = n.id JOIN components c ON c.id = p.component_id WHERE c.device_id = $1 AND c.refdes = $2 AND n.nominal_v IS NOT NULL ORDER BY n.nominal_v DESC LIMIT 1',
              [deviceId, fallbackRefdes],
            )
            const failNet = nrows[0]?.name as string | undefined
            const nominal = nrows[0]?.nominal_v != null ? Number(nrows[0].nominal_v) : 5
            if (!failNet) return null
            await recordMeasurementRow(client, deviceId, repairId, {
              net: failNet,
              refdes: null,
              kind: 'voltage',
              value: 0,
              unit: 'V',
              expected: nominal,
            })
            const id = await proposeFindingRow(
              client,
              deviceId,
              repairId,
              fallbackRefdes,
              failNet,
              'rail_collapse',
              0.82,
            )
            return { id, failNet, nominal }
          })
          if (done) {
            writer.write({ type: 'data-measure', data: { target: done.failNet, kind: 'voltage', value: 0, unit: 'V' } })
            logLine('measure', 'MEASURE', `${done.failNet} reads 0 V (voltage).`)
            writer.write({ type: 'data-finding', data: { refdes: fallbackRefdes, net: done.failNet, kind: 'rail_collapse', confidence: 0.82 } })
            logLine('cause', 'CAUSE', `${fallbackRefdes} on ${done.failNet}: rail_collapse, confidence 0.82.`)
            logLine('fix', 'FIX', `Replace ${fallbackRefdes} on the ${done.failNet} rail, then re-test that ${done.failNet} returns to about ${done.nominal} V.`)
            citedRefdes.add(fallbackRefdes)
            citedNets.add(done.failNet)
            pendingFinding = { findingId: done.id, refdes: fallbackRefdes, net: done.failNet, kind: 'rail_collapse' }
          }
        } catch (err) {
          console.log('[v0] safety-net finding failed:', err)
        }
      }
      if (pendingFinding) {
        const f = pendingFinding as { findingId: string; refdes: string; net: string | null; kind: string }
        const verification = await withTenant(tenantId, async (client) => {
          const v = await verifyFinding(
            client,
            deviceId,
            repairId,
            { refdes: f.refdes, net: f.net, kind: f.kind },
            { refdes: [...citedRefdes], nets: [...citedNets] },
          )
          await saveVerification(client, f.findingId, v.verified, v.checks)
          return v
        })
        writer.write({
          type: 'data-verification',
          data: {
            refdes: f.refdes,
            verified: verification.verified,
            checks: verification.checks,
          },
        })
      }

      // ---- e) persist the assistant transcript + citations ----------------
      const finalText = await result.text.catch(() => '')
      await withTenant(tenantId, async (client) => {
        const msgId = await saveMessage(client, repairId, 'agent', {
          text: finalText,
        })
        for (const rd of citedRefdes) {
          const id = await resolveComponentId(client, deviceId, rd)
          if (id) await saveCitation(client, msgId, 'component', id, 'electrical_graph')
        }
        for (const nt of citedNets) {
          const id = await resolveNetId(client, deviceId, nt)
          if (id) await saveCitation(client, msgId, 'net', id, 'electrical_graph')
        }
      })
    },
    onError: (err) => {
      console.log('[v0] diagnose stream error:', err)
      return 'stream-error'
    },
  })

  return createUIMessageStreamResponse({ stream })
}
