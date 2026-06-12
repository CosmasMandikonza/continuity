import { Instrument } from '@/components/instrument'
import { getMeterUsage } from '@/app/actions'
import { isClerkEnabled } from '@/lib/clerk-config'

// The Workbench — the live diagnostic instrument. Moved off "/" so the root can
// be the public landing page.
export default async function BenchPage() {
  const initialUsage = await getMeterUsage()
  return <Instrument initialUsage={initialUsage} authEnabled={isClerkEnabled()} />
}
