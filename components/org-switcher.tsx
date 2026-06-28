'use client'

import { OrganizationSwitcher } from '@clerk/nextjs'
import { clerkAppearance } from '@/lib/clerk-appearance'

// The shop switcher: create a shop, switch between shops, invite technicians by
// email, and manage members + roles — all from Clerk Organizations, themed to the
// aluminium faceplate. `hidePersonal` keeps it strictly B2B (no personal mode), so
// every signed-in user operates inside a shop. Only rendered when Clerk is enabled.
export function OrgSwitcher({ enabled }: { enabled: boolean }) {
  if (!enabled) return null
  return (
    <div className="flex items-center" aria-label="Shop">
      <OrganizationSwitcher
        appearance={clerkAppearance}
        hidePersonal
        afterCreateOrganizationUrl="/bench"
        afterSelectOrganizationUrl="/bench"
        afterLeaveOrganizationUrl="/bench"
        organizationProfileMode="modal"
        createOrganizationMode="modal"
      />
    </div>
  )
}
