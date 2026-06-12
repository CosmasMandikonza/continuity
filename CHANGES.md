# Continuity — what's in this build

This is the full repo (minus `node_modules`). It turns the single Workbench
page into a startup-grade, multi-view product with a public landing page and
a cross-shop insights view — all backed by your existing Aurora schema.
**No new migrations.** Every view reads tables/functions you already have
(001–012), so there's nothing to run against the database.

## How to push (one move)

If you already have the repo cloned:
1. Extract this zip **over** your clone (let it overwrite — `node_modules` is untouched because it's not in the zip).
2. ```bash
   git add -A
   git commit -m "feat: landing + multi-view shell + Repairs, Knowledge Graph, Fleet"
   git push        # Vercel auto-deploys to continuity-instrument.vercel.app
   ```

Starting fresh instead? `pnpm install` first, then `pnpm dev`.

> I parse-checked every changed/new file and hand-verified the cross-file types
> and the client/server split. Only a real `next build` confirms types end to
> end — run `pnpm build` locally if you want certainty before pushing, otherwise
> Vercel's build will surface anything.

## Route map (what's new)

| Route | What it is |
|---|---|
| `/` | **Landing** — public. The "an AI repair tech that can't make up a part" thesis, an animated claim→verify motif, real fleet numbers, CTA into the app. |
| `/bench` | **Workbench** — the live diagnostic instrument (was `/`). Unchanged behavior. |
| `/repairs` | **Repairs** — the shop's real history from Aurora under RLS: list + detail (transcript, measurements, root-cause finding, verifier ✓/⚠). |
| `/graph` | **Knowledge Graph** — the board's `components`↔`nets` incidence rendered live from the DB (hand-rolled force layout, no new deps). Tap a node → the derived provenance card. |
| `/fleet` | **Fleet / Insights** — cross-shop root-cause distribution from a `SECURITY DEFINER` aggregate, with the privacy guarantee shown. |

Shared chrome: a `Chassis` (frame + faceplate + nav rail + footer) wraps every
app view; the nav rail (Bench / Repairs / Graph / Fleet) tracks the URL.

## Files changed/added in this build
- **Shell:** `components/chassis.tsx`, `components/nav-rail.tsx`, `components/instrument.tsx` (now renders inside Chassis)
- **Landing:** `app/page.tsx` (→ landing), `app/bench/page.tsx` (moved Workbench), `components/landing.tsx`, `middleware.ts` (`/` made public)
- **Repairs:** `app/repairs/page.tsx`, `components/repairs-view.tsx`
- **Knowledge Graph:** `app/graph/page.tsx`, `components/graph-view.tsx`
- **Fleet:** `app/fleet/page.tsx`, `components/fleet-view.tsx`
- **Data layer:** `lib/queries.ts` (+`getGraph`, `listRepairs`, `getRepairDetail`, `fleetBreakdown`), `app/actions.ts` (matching actions). Existing functions untouched.

## Next (model-independent, $0)
- A second open-hardware device (Device library) so the board isn't a sample size of one.
- Optional: seed a couple of repairs under your dev/owner tenant so `/repairs` is populated for filming (otherwise it fills as you run diagnoses).

## The one paid piece (next week)
Add a payment method to Vercel (activates the already-wired AI Gateway) or an
Anthropic key, then run the **live agent end-to-end** and debug it — real tool
calls, grounding, and the verifier on a real finding. That's the only unproven
part, and the demo video must show it running for real, not the scripted
fallback.
