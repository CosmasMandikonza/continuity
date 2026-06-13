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
} from '@/lib/queries'
import { verifyFinding } from '@/lib/verify'
import { diagnosticModel, modelProviderOptions, HAS_MODEL_CREDS } from '@/lib/model'
import { getTenantContext } from '@/lib/tenant'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEVICE_NAME = 'MNT Reform'

const SYSTEM_PROMPT = `You are Continuity, a meticulous board-level repair diagnostician working a live bench.

Hard rules — you will be audited against the database:
- Start by calling commonFailures: it returns the parts most often confirmed as the root cause for THIS symptom across the fleet, with their share of past repairs. Prioritize tracing and measuring those first.
- You only know this board through tools. Discover it via traceNet, inspectComponent, netMembers. NEVER name a refdes or net you have not seen in a tool result.
- NEVER invent part numbers, values, or packages. Only state what inspectComponent returned.
- Record EVERY measurement you reason from with recordMeasurement before you cite it as evidence.
- Propose EXACTLY ONE root-cause finding with proposeFinding, with a calibrated confidence (0-1). Then give a short numbered repair protocol.
- A 'short' finding requires a recorded low-resistance measurement on that part/net. A rail collapse requires a measured voltage well below the net's nominal. Take those measurements first.
- If a tool returns found:false, say so plainly ("no such part on this board"). Do not substitute a similar refdes.
- If the evidence is insufficient, return an INCONCLUSIVE result naming the single next measurement to take. NEVER fabricate a culprit to seem decisive.
- CALL tools through the function interface — never write a tool name (commonFailures, traceNet, recordMeasurement, proposeFinding) or its arguments in your visible text. Your messages are read by a human technician and must be plain English, never code or a function call.

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
      const tools = {
        commonFailures: tool({
          description:
            'Fleet history for THIS symptom: the components most often confirmed as the root cause across all shops, with their share of past repairs. Call this FIRST to decide which parts to trace and measure.',
          inputSchema: z.object({}),
          execute: async () => {
            const rows = await failureRate(deviceId, symptom)
            rows.forEach((r) => citedRefdes.add(r.refdes))
            return {
              symptom,
              topCauses: rows.slice(0, 5).map((r) => ({
                refdes: r.refdes,
                kind: r.kind,
                pctOfRepairs: r.pct,
                confirmedRepairs: r.rootCauses,
              })),
            }
          },
        }),

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
            return { proposed: true, findingId, refdes, kind, confidence }
          },
        }),
      }

      // ---- run the tool loop ---------------------------------------------
      const result = streamText({
        model: diagnosticModel(),
        system: SYSTEM_PROMPT,
        providerOptions: modelProviderOptions(),
        messages: [
          {
            role: 'user',
            content: `Device under test: ${deviceName}. Symptom from the tech: "${symptom}". Diagnose it.`,
          },
        ],
        tools,
        stopWhen: stepCountIs(8),
        prepareStep: ({ stepNumber, steps }) => {
          const called: string[] = steps.flatMap((s) =>
            (s.toolCalls ?? []).map((t) => t.toolName),
          )
          const measured = called.includes('recordMeasurement')
          const proposed = called.includes('proposeFinding')
          // Step 0: force a tool call so a reasoning model can't answer from
          // priors — it must investigate (the prompt points it at
          // commonFailures first).
          if (stepNumber === 0) return { toolChoice: 'required' }
          // Don't let it conclude on no evidence: require a measurement first.
          if (stepNumber >= 4 && !measured && !proposed) {
            return { toolChoice: { type: 'tool', toolName: 'recordMeasurement' } }
          }
          // Guarantee the single root-cause finding — and therefore the
          // deterministic verifier — ALWAYS fires, even if the model would
          // rather narrate it. This is what makes "verified" a guarantee.
          if (stepNumber >= 6 && !proposed) {
            return { toolChoice: { type: 'tool', toolName: 'proposeFinding' } }
          }
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
