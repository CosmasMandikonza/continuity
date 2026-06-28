import { Chassis } from '@/components/chassis'
import { FleetView } from '@/components/fleet-view'
import { getMeterUsage, getFleetBreakdown } from '@/app/actions'
import { isClerkEnabled } from '@/lib/clerk-config'
import { MODEL_LABEL } from '@/lib/model'

// Cross-shop root-cause intelligence — the one surface that cannot exist
// without a database. Aggregated past RLS by a SECURITY DEFINER function that
// returns only percentages, never another shop's rows.
export default async function FleetPage() {
  const [usage, breakdown] = await Promise.all([getMeterUsage(), getFleetBreakdown()])
  return (
    <Chassis meterUsage={usage} authEnabled={isClerkEnabled()} modelLabel={MODEL_LABEL}>
      <FleetView breakdown={breakdown} deviceName="MNT Reform" />
    </Chassis>
  )
}
