import { Pool } from 'pg'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
const signer = new Signer({ credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN, clientConfig: { region: process.env.AWS_REGION } }), region: process.env.AWS_REGION, hostname: process.env.PGHOST, username: process.env.PGUSER||'postgres', port: 5432 })
const pool = new Pool({ host: process.env.PGHOST, database: process.env.PGDATABASE||'postgres', port: 5432, user: process.env.PGUSER||'postgres', password: () => signer.getAuthToken(), ssl: { rejectUnauthorized: false }, max: 2 })

const CK = 'user_TEST_clerk_123'
async function withTenant(id, fn) {
  const c = await pool.connect()
  try { await c.query('BEGIN'); await c.query("SELECT set_config('app.current_tenant', $1, true)", [id]); const r = await fn(c); await c.query('COMMIT'); return r }
  catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
}

// Provision twice (idempotency check)
for (let i = 0; i < 2; i++) {
  const t = await pool.query(`INSERT INTO tenants (name, clerk_user_id) VALUES ($1,$2) ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL DO UPDATE SET name=EXCLUDED.name RETURNING id`, ['Test Bench', CK])
  const tid = t.rows[0].id
  const uid = await withTenant(tid, async (c) => {
    const r = await c.query(`INSERT INTO users (tenant_id,email,name,role,clerk_user_id) VALUES ($1,$2,$3,'owner',$4) ON CONFLICT (clerk_user_id) WHERE clerk_user_id IS NOT NULL DO UPDATE SET email=EXCLUDED.email RETURNING id`, [tid,'test@x.com','Test Bench',CK])
    return r.rows[0].id
  })
  console.log(`run${i}: tenant=${tid} user=${uid}`)
}
// Verify isolation: this tenant sees no repairs from dev tenant
const t = await pool.query(`SELECT id FROM tenants WHERE clerk_user_id=$1`, [CK])
const tid = t.rows[0].id
const seen = await withTenant(tid, (c) => c.query('SELECT count(*)::int n FROM repairs'))
console.log('repairs visible to new tenant (should be 0):', seen.rows[0].n)
// Cleanup
await withTenant(tid, (c) => c.query('DELETE FROM users WHERE clerk_user_id=$1', [CK]))
await pool.query('DELETE FROM tenants WHERE clerk_user_id=$1', [CK])
console.log('cleaned up')
await pool.end()
