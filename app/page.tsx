import { Instrument } from '@/components/instrument'
import { getMeterUsage } from '@/app/actions'
import { isClerkEnabled } from '@/lib/clerk-config'

export default async function Page() {
  // The signed-in shop's real usage on first paint (DEV fallback when no auth).
  const initialUsage = await getMeterUsage()
  return <Instrument initialUsage={initialUsage} authEnabled={isClerkEnabled()} />
}
