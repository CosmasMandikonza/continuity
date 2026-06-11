import { Pool, type PoolClient } from 'pg'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { attachDatabasePool } from '@vercel/functions'

const signer = new Signer({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION },
  }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST!,
  username: process.env.PGUSER || 'postgres',
  port: 5432,
})

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE || 'postgres',
  port: 5432,
  user: process.env.PGUSER || 'postgres',
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 20,
})
attachDatabasePool(pool)

// Single-statement query (no tenant scoping — use for shared/public reads only).
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params)
}

// Multi-statement transaction.
export async function withConnection<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

// Runs `fn` inside a transaction with app.current_tenant set, so RLS policies apply.
export async function withTenant<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withConnection(async (client) => {
    await client.query('BEGIN')
    try {
      // set_config(..., true) => scoped to this transaction only.
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant', tenantId])
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })
}
