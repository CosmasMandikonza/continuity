import Link from 'next/link'

// Public pricing — the monetization model for the Monetizable B2B track, made
// concrete. Tiers map to the two axes a repair business actually scales on:
// diagnostic volume (the real per-shop tenant_usage meter you see on the bench)
// and technicians on the bench (Clerk-organization seats).

interface Tier {
  name: string
  price: string
  cadence?: string
  blurb: string
  cta: string
  href: string
  highlight?: boolean
  features: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Solo',
    price: 'Free',
    blurb: 'For a single technician getting started.',
    cta: 'Start free',
    href: '/sign-up',
    features: [
      '1 technician',
      '25 grounded diagnoses / month',
      'Deterministic verification on every finding',
      'Cross-shop fleet benchmark (read-only)',
    ],
  },
  {
    name: 'Shop',
    price: '$79',
    cadence: '/ month',
    blurb: 'For an independent repair shop and its bench.',
    cta: 'Create your shop',
    href: '/sign-up',
    highlight: true,
    features: [
      'Up to 5 technicians',
      '500 diagnoses / month',
      'Private shop memory — pgvector recall over your own confirmed repairs',
      'Shared team history + technician audit trail',
      'Cross-shop fleet benchmarking',
    ],
  },
  {
    name: 'Network',
    price: 'Custom',
    blurb: 'For multi-location operations and OEM repair programs.',
    cta: 'Contact us',
    href: '/sign-up',
    features: [
      'Unlimited technicians & locations',
      'Unlimited diagnoses',
      'Board-graph ingestion for your own devices',
      'API access + SSO',
      'Priority support',
    ],
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-[1080px] px-6 py-10 md:py-14">
        {/* nav */}
        <header className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-[10px]">
            <span className="font-display text-[15px] font-bold tracking-[-0.01em]">
              CONTI<span className="text-flux">NUITY</span>
            </span>
          </Link>
          <Link
            href="/bench"
            className="ml-auto font-mono text-[11px] text-ink-2s transition-colors hover:text-ink"
          >
            Explore the demo
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full border border-flux bg-flux px-[14px] py-[7px] font-mono text-[11px] font-semibold text-[#fff7e9] transition-transform hover:-translate-y-[1px]"
          >
            Create your shop&nbsp;→
          </Link>
        </header>

        {/* heading */}
        <section className="mt-12 text-center md:mt-16">
          <span className="ucl text-[11px] text-flux-ink">Pricing</span>
          <h1 className="mx-auto mt-[12px] max-w-[34rem] font-display text-[34px] font-bold leading-[1.05] tracking-[-0.02em] md:text-[46px]">
            Priced per shop, scaled by your bench.
          </h1>
          <p className="mx-auto mt-[16px] max-w-[34rem] font-sans text-[14px] leading-[1.6] text-ink-2s">
            Every plan is grounded in the same real electrical graph and verified by the same
            deterministic checks. You pay for the two things a repair business actually scales on:
            diagnostic volume and the technicians on your bench.
          </p>
        </section>

        {/* tiers */}
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-[14px] border p-[20px] ${
                t.highlight
                  ? 'border-flux bg-[#fff7e9] shadow-[0_18px_44px_-22px_var(--flux)]'
                  : 'border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)]'
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-[10px] left-[20px] rounded-full border border-flux bg-flux px-[10px] py-[3px] font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#fff7e9]">
                  Most popular
                </span>
              )}
              <div className="font-display text-[18px] font-bold">{t.name}</div>
              <div className="mt-[8px] flex items-baseline gap-[4px]">
                <span className="font-display text-[34px] font-bold leading-none">{t.price}</span>
                {t.cadence && <span className="font-mono text-[11px] text-ink-3">{t.cadence}</span>}
              </div>
              <p className="mt-[8px] font-sans text-[12px] leading-[1.5] text-ink-2s">{t.blurb}</p>
              <ul className="mt-[14px] flex flex-1 flex-col gap-[9px]">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-[8px] font-sans text-[12px] leading-[1.45] text-ink-2s"
                  >
                    <span className="mt-[6px] h-[5px] w-[5px] flex-none rounded-full bg-flux" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={t.href}
                className={`mt-[18px] rounded-full px-[16px] py-[10px] text-center font-mono text-[12px] font-semibold transition-transform hover:-translate-y-[1px] ${
                  t.highlight
                    ? 'border border-flux bg-flux text-[#fff7e9] shadow-[0_10px_26px_-12px_var(--flux)]'
                    : 'border border-rule-2 bg-[#fff7e9] text-ink-2s hover:border-rule-strong'
                }`}
              >
                {t.cta}&nbsp;→
              </Link>
            </div>
          ))}
        </section>

        {/* honest note */}
        <p className="mx-auto mt-10 max-w-[37rem] text-center font-mono text-[10px] leading-[1.6] text-ink-3">
          Usage is metered per shop in Aurora — the same counter you see on the bench — and seats are
          managed through your shop&rsquo;s organization. This is a hackathon prototype: the plans show
          the model; checkout is not wired.
        </p>

        <footer className="mt-12 flex flex-col items-center gap-2 border-t border-rule pt-8 text-center">
          <div className="font-mono text-[10px] tracking-[0.06em] text-ink-3">
            Aurora PostgreSQL + pgvector · tenant-scoped multi-shop · Next.js on Vercel
          </div>
          <Link
            href="/"
            className="font-mono text-[10px] text-flux-ink transition-colors hover:underline"
          >
            ← Back to home
          </Link>
        </footer>
      </div>
    </main>
  )
}
