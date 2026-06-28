// Single source of truth for the diagnostic model.
//
// Provider cascade, highest quality first, with graceful degradation:
//   1. bedrock  - Claude (Opus) on Amazon Bedrock; keeps inference on AWS.
//   2. gateway  - Claude family through the Vercel AI Gateway (needs billing).
//   3. groq     - open models on Groq's free tier, hit directly with GROQ_API_KEY.
//   4. none     - the route replays the scripted diagnosis (no creds anywhere).
//
// The database keeps every one of these honest: whatever model runs, its
// citations must resolve to real rows and the deterministic verifier re-checks
// each finding. Swapping providers never weakens the grounding - that is the
// whole point of grounding it in the schema instead of trusting the model.
//
// Dev can override the model id per transport with CONTINUITY_MODEL (e.g. a
// Haiku / smaller Llama for cheaper runs) without touching route code.

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createGroq } from '@ai-sdk/groq'
import { createAnthropic } from '@ai-sdk/anthropic'

// --- model ids per transport ------------------------------------------------
// Bedrock cross-region inference profile for Claude Opus.
const BEDROCK_MODEL = 'us.anthropic.claude-opus-4-1-20250805-v1:0'
// Gateway model id (latest Opus available through the AI Gateway).
const GATEWAY_MODEL = 'anthropic/claude-opus-4.8'
// Groq free tier, tool-calling capable. 30 RPM / 12K TPM / 100K TPD.
const GROQ_MODEL = 'llama-3.3-70b-versatile'
// Anthropic direct (Claude). Vision-capable + strong multi-step tool use; this is
// the transport that powers the camera and makes the chain reliable.
const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

// --- which credentials are present ------------------------------------------
const HAS_BEDROCK = Boolean(
  process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.AWS_REGION,
)
const HAS_GATEWAY = Boolean(process.env.AI_GATEWAY_API_KEY)
const HAS_GROQ = Boolean(process.env.GROQ_API_KEY)
const HAS_ANTHROPIC = Boolean(process.env.ANTHROPIC_API_KEY)

export type ModelTransport = 'bedrock' | 'anthropic' | 'gateway' | 'groq' | 'none'

// First transport with credentials wins.
export const MODEL_TRANSPORT: ModelTransport = HAS_BEDROCK
  ? 'bedrock'
  : HAS_ANTHROPIC
    ? 'anthropic'
    : HAS_GATEWAY
      ? 'gateway'
      : HAS_GROQ
        ? 'groq'
        : 'none'

const DEFAULT_MODEL: Record<ModelTransport, string> = {
  bedrock: BEDROCK_MODEL,
  anthropic: ANTHROPIC_MODEL,
  gateway: GATEWAY_MODEL,
  groq: GROQ_MODEL,
  none: GATEWAY_MODEL,
}

// Resolve the model id, honoring a dev override per transport.
export const CONTINUITY_MODEL =
  process.env.CONTINUITY_MODEL || DEFAULT_MODEL[MODEL_TRANSPORT]

// On the Anthropic transport, ignore a leftover non-Claude CONTINUITY_MODEL
// (e.g. a Groq id from the earlier setup) so switching providers can never send
// an invalid model string to Anthropic.
const RESOLVED_MODEL =
  MODEL_TRANSPORT === 'anthropic' && !CONTINUITY_MODEL.toLowerCase().includes('claude')
    ? ANTHROPIC_MODEL
    : CONTINUITY_MODEL

// The route falls back to the scripted replay whenever this is false.
export const HAS_MODEL_CREDS = MODEL_TRANSPORT !== 'none'

// --- provider clients -------------------------------------------------------
const bedrock = HAS_BEDROCK
  ? createAmazonBedrock({ region: process.env.AWS_REGION })
  : null

const groq = HAS_GROQ
  ? createGroq({ apiKey: process.env.GROQ_API_KEY })
  : null

const anthropic = HAS_ANTHROPIC
  ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

// Returns a provider model object (bedrock / groq) or a gateway model-id
// string; all three are accepted by streamText's `model` parameter.
export function diagnosticModel() {
  if (MODEL_TRANSPORT === 'bedrock' && bedrock) return bedrock(RESOLVED_MODEL)
  if (MODEL_TRANSPORT === 'anthropic' && anthropic) return anthropic(RESOLVED_MODEL)
  if (MODEL_TRANSPORT === 'groq' && groq) return groq(RESOLVED_MODEL)
  return RESOLVED_MODEL
}

// Only Bedrock + Opus supports the adaptive reasoning option. Every other
// transport (gateway, groq, cheaper dev overrides) must not receive it.
export function modelProviderOptions() {
  if (MODEL_TRANSPORT === 'bedrock' && /opus/i.test(CONTINUITY_MODEL)) {
    return {
      bedrock: {
        reasoningConfig: {
          type: 'adaptive' as const,
          maxReasoningEffort: 'medium' as const,
        },
      },
    }
  }
  return undefined
}

// --- honest faceplate label -------------------------------------------------
// What the instrument should actually display, derived from the live transport
// and model id - never a hardcoded claim. Threaded to the client as a prop by
// the bench page (this module is server-only).
function prettyModelName(id: string): string {
  const m = id.toLowerCase()
  if (m.includes('opus')) return 'CLAUDE OPUS'
  if (m.includes('sonnet')) return 'CLAUDE SONNET'
  if (m.includes('haiku')) return 'CLAUDE HAIKU'
  if (m.includes('llama-3.3-70b')) return 'LLAMA 3.3 70B'
  if (m.includes('llama')) return 'LLAMA'
  if (m.includes('qwen')) return 'QWEN'
  if (m.includes('deepseek')) return 'DEEPSEEK'
  if (m.includes('gpt-oss')) return 'GPT-OSS'
  const tail = id.split('/').pop() || id
  return tail.split(':')[0].toUpperCase()
}

const TRANSPORT_TAG: Record<ModelTransport, string> = {
  bedrock: 'BEDROCK',
  anthropic: 'ANTHROPIC',
  gateway: 'GATEWAY',
  groq: 'GROQ',
  none: 'REPLAY',
}

// e.g. 'LLAMA 3.3 70B · GROQ', 'CLAUDE OPUS · BEDROCK', 'SCRIPTED · REPLAY'
export const MODEL_LABEL: string =
  MODEL_TRANSPORT === 'none'
    ? 'SCRIPTED · REPLAY'
    : prettyModelName(RESOLVED_MODEL) + ' · ' + TRANSPORT_TAG[MODEL_TRANSPORT]
