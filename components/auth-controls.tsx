'use client'

import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { OrgSwitcher } from './org-switcher'
import { AuthButton } from './auth-button'

// Rendered only when Clerk is configured (the faceplate gates on authEnabled), so
// useAuth always runs inside ClerkProvider. Signed-in technicians get the shop
// switcher + account menu; guests (demo mode) get a "Create your shop" CTA.
//
// We use the useAuth hook rather than <SignedIn>/<SignedOut> because
// @clerk/nextjs 7.x does not export those control components from its package
// root (verified against 7.5.2 — only hooks like useAuth/useUser are exported).
export function AuthControls() {
  const { isLoaded, isSignedIn } = useAuth()

  // Before Clerk hydrates, render nothing rather than flash the wrong state.
  if (!isLoaded) return null

  if (isSignedIn) {
    return (
      <>
        <OrgSwitcher enabled />
        <AuthButton enabled />
      </>
    )
  }

  return (
    <>
      <span className="hidden items-center gap-[6px] rounded-full border border-rule-2 bg-[#fff7e9] px-[10px] py-[5px] font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3 sm:flex">
        <span className="h-[6px] w-[6px] rounded-full bg-caution shadow-[0_0_7px_#ffc24d]" />
        Demo shop
      </span>
      <Link
        href="/sign-up"
        className="whitespace-nowrap rounded-full border border-flux bg-flux px-[13px] py-[6px] font-mono text-[10px] font-semibold text-[#fff7e9] shadow-[0_8px_20px_-10px_var(--flux)] transition-transform hover:-translate-y-[1px]"
      >
        Create your shop&nbsp;→
      </Link>
    </>
  )
}
