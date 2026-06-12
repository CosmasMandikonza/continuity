import { Landing } from '@/components/landing'
import { getFailureRate } from '@/app/actions'

// Public marketing landing. Pulls the one real, load-bearing number (the
// cross-shop top root-cause rate) so even the front door is database-backed.
export default async function Page() {
  const fleet = await getFailureRate().catch(() => null)
  return <Landing topCause={fleet} />
}
