// Single source of truth for the diagnostic model.
//
// Preferred: Claude (Opus) on Amazon Bedrock — keeps inference on AWS and spends
// Bedrock credits. @ai-sdk/amazon-bedrock reads AWS_BEARER_TOKEN_BEDROCK +
// AWS_REGION from the environment automatically.
//
// Fallback: when no Bedrock token is present but the Vercel AI Gateway is
// configured, run the same Claude family through the gateway by passing a plain
// model-id string to streamText. Either way the route gets a real Claude.
//
// Dev can override the id with CONTINUITY_MODEL (e.g. a Haiku / Nova for cheaper
// runs) without touching route code.

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

// Bedrock cross-region inference profile for Claude Opus.
const BEDROCK_MODEL = 'us.anthropic.claude-opus-4-1-20250805-v1:0'
// Gateway model id (latest Opus available through the AI Gateway).
const GATEWAY_MODEL = 'anthropic/claude-opus-4.8'

const HAS_BEDROCK = Boolean(
  process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.AWS_REGION,
)
const HAS_GATEWAY = Boolean(process.env.AI_GATEWAY_API_KEY)

// Which transport are we using this run?
export const MODEL_TRANSPORT: 'bedrock' | 'gateway' | 'none' = HAS_BEDROCK
  ? 'bedrock'
  : HAS_GATEWAY
    ? 'gateway'
    : 'none'

// Resolve the model id, honoring a dev override per transport.
export const CONTINUITY_MODEL =
  process.env.CONTINUITY_MODEL ||
  (MODEL_TRANSPORT === 'bedrock' ? BEDROCK_MODEL : GATEWAY_MODEL)

// The route falls back to the scripted replay whenever this is false.
export const HAS_MODEL_CREDS = MODEL_TRANSPORT !== 'none'

const bedrock = HAS_BEDROCK
  ? createAmazonBedrock({ region: process.env.AWS_REGION })
  : null

// Returns either a Bedrock model object or a gateway model-id string; both are
// accepted by streamText's `model` parameter.
export function diagnosticModel() {
  if (MODEL_TRANSPORT === 'bedrock' && bedrock) return bedrock(CONTINUITY_MODEL)
  return CONTINUITY_MODEL
}

// Opus on Bedrock supports adaptive reasoning. Only set provider options for the
// Bedrock transport so a gateway run (or a cheaper dev override) isn't sent an
// unsupported option.
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
