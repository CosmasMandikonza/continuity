'use client'

import { UserButton } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

// Small themed UserButton for the faceplate. Only rendered when Clerk is
// configured (the parent passes enabled=false in the no-auth dev demo, so the
// scripted run never touches the Clerk SDK).
export function AuthButton({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  return (
    <div className="flex items-center" aria-label="Account">
      <UserButton
        appearance={clerkAppearance}
        userProfileMode="modal"
        afterSignOutUrl="/sign-in"
      />
    </div>
  )
}
