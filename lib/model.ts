// Single source of truth for the diagnostic model.
//
// Claude (Opus) on Amazon Bedrock by default — keeps inference on AWS and spends
// the Bedrock credits. Dev can point CONTINUITY_MODEL at a cheaper model
// (Claude Haiku / Amazon Nova) to save credits without touching route code.
//
// Auth: @ai-sdk/amazon-bedrock reads AWS_BEARER_TOKEN_BEDROCK + AWS_REGION from
// the environment automatically, so we just pass the model id string-form via
// the provider below.

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'

// Cross-region inference profile for the current Claude Opus on Bedrock.
const DEFAULT_MODEL = 'us.anthropic.claude-opus-4-1-20250805-v1:0'

export const CONTINUITY_MODEL = process.env.CONTINUITY_MODEL || DEFAULT_MODEL

// True only when we actually have Bedrock credentials. The route falls back to
// the scripted replay whenever this is false (never a blank screen).
export const HAS_MODEL_CREDS = Boolean(
  process.env.AWS_BEARER_TOKEN_BEDROCK && process.env.AWS_REGION,
)

export const bedrock = createAmazonBedrock({
  // apiKey + region are picked up from AWS_BEARER_TOKEN_BEDROCK / AWS_REGION,
  // but we pass region explicitly so it tracks the same value db.ts uses.
  region: process.env.AWS_REGION,
})

export function diagnosticModel() {
  return bedrock(CONTINUITY_MODEL)
}

// Opus 4.7+ supports adaptive reasoning. Enable it only for Opus models so a
// cheaper dev override (Haiku / Nova) doesn't get an unsupported option.
export function modelProviderOptions() {
  if (/opus/i.test(CONTINUITY_MODEL)) {
    return {
      bedrock: {
        reasoningConfig: { type: 'adaptive' as const, maxReasoningEffort: 'medium' as const },
      },
    }
  }
  return undefined
}
