import { Chassis } from '@/components/chassis'
import { RepairsView } from '@/components/repairs-view'
import { getMeterUsage, listRepairsAction } from '@/app/actions'
import { isClerkEnabled } from '@/lib/clerk-config'
import { MODEL_LABEL } from '@/lib/model'

// Real repair history for the signed-in shop, read from Aurora under RLS.
export default async function RepairsPage() {
  const [usage, repairs] = await Promise.all([getMeterUsage(), listRepairsAction()])
  return (
    <Chassis meterUsage={usage} authEnabled={isClerkEnabled()} modelLabel={MODEL_LABEL}>
      <RepairsView repairs={repairs} />
    </Chassis>
  )
}
