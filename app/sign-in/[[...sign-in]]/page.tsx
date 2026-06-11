import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-[11px]">
        <svg className="h-[26px] w-[26px] flex-none" viewBox="0 0 30 30" fill="none" aria-hidden>
          <rect x="3" y="3" width="24" height="24" rx="4" stroke="var(--ink)" strokeWidth="1.5" />
          <path
            d="M8 12h6l2.6 2.6H22"
            stroke="var(--flux)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="12" r="1.7" fill="var(--ink)" />
          <circle cx="22" cy="14.6" r="1.7" fill="var(--flux)" />
        </svg>
        <div>
          <div className="font-display text-[16px] font-bold leading-none tracking-[-0.01em] text-ink">
            CONTI<span className="text-flux">NUITY</span>
          </div>
          <div className="mt-[3px] font-mono text-[8.5px] tracking-[0.18em] text-ink-3">
            BENCH&nbsp;DIAGNOSTIC&nbsp;INSTRUMENT
          </div>
        </div>
      </div>
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/" />
    </main>
  )
}
