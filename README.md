# Continuity

**An AI bench technician for board-level electronics repair that physically can't hallucinate a part — because every component it names must exist as a row in the database, and every finding is re-checked by deterministic SQL before a human sees it.**

🔧 **Live demo:** [continuity-instrument.vercel.app](https://continuity-instrument.vercel.app) — click **"Explore the live demo"** (no account needed).

> First load may take ~10–15s while the serverless database wakes from idle; once warm, everything is instant.

---

## The idea

Most AI demos are forgiving — if a chatbot invents a detail, you re-prompt. Continuity is built for a domain where a confident hallucination has a physical cost: board repair. A wrong call desolders a good part, scraps a repairable board, or ships a fault back to a customer.

So the design goal was never "make the model smarter." It was: **make it impossible for the model to lie.** The answer lives almost entirely in the database.

> **The thesis: the database makes the agent honest.** The agent can reason, but it can only *cite* what Amazon Aurora returns. There's no row for a part? Then there's no such part. The model literally cannot invent a component, because the only way it perceives the board is by querying rows that exist.

## What it does

A technician types a symptom — `no power` — and Continuity takes it from **symptom → root cause → the exact pin to probe**, then turns each repair into institutional memory:

1. The agent walks the board's power tree with a **recursive query** (`USB-C → regulator → the dead rail → the SoC`).
2. It records measurements (`PP5V0 = 0 V`, `0.15 Ω` to ground — a dead short).
3. It returns a root cause — **C29, shorted** — with the repair protocol.
4. A **deterministic verifier** re-checks the finding against the board and stamps it **VERIFIED ✓**. The model doesn't get to vote.
5. The tech clicks **Confirm root cause** → the case is embedded into the shop's private vector memory.
6. Next week a different tech types `5 volt rail won't come up` — same fault, different words — and Continuity recalls the shop's own prior case by **meaning** (pgvector).

## Why the database *is* the architecture

Everything load-bearing is a deliberate Amazon Aurora (PostgreSQL) decision — Aurora is the integrity layer, not a storage bucket.

| Concern | How Aurora solves it |
| --- | --- |
| **No hallucinated parts** | The agent's tools only return rows. Referential integrity becomes a hallucination guardrail. |
| **Tracing a circuit** | The board is a graph (`components`, `nets`, `pins`, `edges`); a `WITH RECURSIVE` query walks the power tree. |
| **Compounding memory** | Confirmed findings are embedded and indexed with **pgvector + HNSW** for semantic recall, scoped per shop. |
| **Multi-tenant isolation** | Per-shop scoping on every query, with **Row-Level Security** policies as a guardrail. |
| **Privacy-preserving benchmarking** | A `SECURITY DEFINER` aggregate crosses the tenant boundary by design and returns **only counts** — the rows never do. |
| **No secrets** | The app authenticates to Aurora with short-lived **IAM** tokens via Vercel OIDC — no database password anywhere. |

A taste of the data layer — tracing a power rail is a query, not a guess:

```sql
WITH RECURSIVE power_path AS (
  SELECT e.from_net, e.to_net, e.kind, 1 AS depth
  FROM edges e
  WHERE e.to_net = (SELECT id FROM nets WHERE name = 'PP5V0_SYS')
  UNION ALL
  SELECT e.from_net, e.to_net, e.kind, pp.depth + 1
  FROM edges e JOIN power_path pp ON e.to_net = pp.from_net
  WHERE pp.depth < 12
)
SELECT * FROM power_path;
```

…and the cross-shop benchmark shares the pattern, never the rows:

```sql
CREATE FUNCTION fleet_failure_rate(p_symptom text)
RETURNS TABLE (refdes text, rate numeric, n int)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.refdes,
         round(count(*)::numeric / sum(count(*)) OVER (), 2) AS rate,
         count(*)::int
  FROM findings f
  JOIN repairs r ON r.id = f.repair_id
  JOIN components c ON c.id = f.component_id
  WHERE f.status = 'confirmed' AND r.symptom = p_symptom
  GROUP BY c.refdes ORDER BY rate DESC;
$$;
```

## Architecture

![Continuity architecture](./docs/continuity-architecture.png)

```
Technician → Next.js on Vercel → AI Agent (tools that read rows only)
                                      │
                                      ▼
                          Amazon Aurora (PostgreSQL, IAM auth)
              electrical graph · pgvector/HNSW · RLS · SECURITY DEFINER
                                      │
                                      ▼
                    Deterministic SQL verifier  →  VERIFIED ✓
                                      │
              technician confirms → embed → pgvector (shop memory)
```

## Tech stack

- **Database:** Amazon Aurora (PostgreSQL) with `pgvector`, IAM authentication
- **Frontend/Hosting:** Next.js (App Router) on **Vercel**
- **Auth & teams:** Clerk Organizations (a shop = an organization)
- **Agent:** model-agnostic tool-using loop (runs on an open model today; one env var from a frontier model)
- **Embeddings:** Cohere (1024-dim, HNSW cosine index)
- **Language:** TypeScript

## The B2B model

Continuity is a per-shop SaaS, priced on the two axes a repair business scales on — **diagnostic volume** (metered per shop in Aurora) and **technicians on the bench** (Clerk org seats). Each shop's confirmed repairs become a private, compounding knowledge asset a competitor can't copy and a new hire inherits on day one.

## Local development

**Prerequisites:** Node 18+, pnpm, an Aurora PostgreSQL instance (with `pgvector`) reachable via IAM auth, and Clerk + Cohere keys.

```bash
pnpm install
pnpm dev   # http://localhost:3000
```

Environment variables (`.env.local`):

```bash
# Aurora via IAM (no password / no connection string)
PGHOST=your-cluster.cluster-xxxx.<region>.rds.amazonaws.com
PGUSER=your_iam_db_user
PGDATABASE=continuity
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::<acct>:role/your-vercel-oidc-role

# Auth (Clerk) — enable Organizations in the Clerk dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Agent model (open model via Groq by default)
GROQ_API_KEY=gsk_...
CONTINUITY_MODEL=openai/gpt-oss-120b
# Optional: switch to Claude — set ANTHROPIC_API_KEY and CONTINUITY_MODEL=claude-...

# Embeddings + one-time migration guard
COHERE_API_KEY=...
BACKFILL_SECRET=<random-string>
```

**Database setup:** run the SQL migrations in `scripts/` against your cluster (schema, RLS, seed), then hit the one-time, secret-protected routes to install the vector + org features and backfill embeddings:

```
/api/migrate-014?secret=$BACKFILL_SECRET   # Clerk org → tenant mapping
/api/migrate-015?secret=$BACKFILL_SECRET   # shop-scoped pgvector retrieval
/api/embed-backfill?secret=$BACKFILL_SECRET # embed seeded confirmed findings
```

## Project structure

```
app/            Next.js routes — bench, repairs, graph, fleet, pricing, api/*
components/     Bench instrument UI (faceplate, console, graph, fleet, repairs)
lib/            db (IAM auth), tenant resolution, queries, embeddings, verifier, model
scripts/        SQL migrations + seed (the schema, RLS, graph, pgvector)
```

## Notes

- The public demo runs on an open model (GPT-OSS), so the optional camera/photo input is disabled there; the text-driven diagnosis is the full experience.
- Fleet figures use synthetic seed data to demonstrate the cross-shop mechanism — the privacy boundary (`SECURITY DEFINER`, RLS) is real.

---

_Built for the AWS × Vercel "Hack the Zero Stack" (H0) Hackathon. **#H0Hackathon**_
