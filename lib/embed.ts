// ---------------------------------------------------------------------------
// Embeddings — Cohere embed-english-v3.0 (1024-dim, matches the schema's
// vector(1024) columns). Used to turn a free-text symptom into a query vector
// for pgvector cosine search, and to embed the seeded cases during backfill.
//
// v3 models REQUIRE an input_type:
//   search_query    — the incoming symptom we search WITH
//   search_document — the stored past cases we search OVER
// ---------------------------------------------------------------------------

const COHERE_EMBED_URL = 'https://api.cohere.com/v1/embed'
const COHERE_MODEL = 'embed-english-v3.0'
const DIMS = 1024

export type EmbedInputType = 'search_query' | 'search_document'

export async function embedText(text: string, inputType: EmbedInputType): Promise<number[]> {
  const key = process.env.COHERE_API_KEY
  if (!key) throw new Error('COHERE_API_KEY is not set')

  const res = await fetch(COHERE_EMBED_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      model: COHERE_MODEL,
      texts: [text],
      input_type: inputType,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Cohere embed failed (${res.status}): ${detail.slice(0, 180)}`)
  }

  const data: unknown = await res.json()
  const vec = extractEmbedding(data)
  if (!vec || vec.length !== DIMS) {
    throw new Error(`Cohere embed: expected ${DIMS} dims, got ${vec?.length ?? 'none'}`)
  }
  return vec
}

// Cohere returns embeddings as either a plain 2-D array (default float type) or
// an object keyed by type ({ float: [[...]] }) when embedding_types is set.
function extractEmbedding(data: unknown): number[] | null {
  const e = (data as { embeddings?: unknown })?.embeddings
  if (Array.isArray(e) && Array.isArray(e[0])) return e[0] as number[]
  const f = (e as { float?: unknown } | undefined)?.float
  if (Array.isArray(f) && Array.isArray(f[0])) return f[0] as number[]
  return null
}

// pgvector accepts a vector as its text form: [v1,v2,...]. Pass this as a query
// param and cast it with $n::vector in SQL.
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}
