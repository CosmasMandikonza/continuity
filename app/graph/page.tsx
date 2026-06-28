import { Chassis } from '@/components/chassis'
import { GraphView } from '@/components/graph-view'
import { getMeterUsage, getDeviceGraph } from '@/app/actions'
import { isClerkEnabled } from '@/lib/clerk-config'
import { MODEL_LABEL } from '@/lib/model'

// The shared reference board's electrical graph, rendered live from Aurora —
// components and nets as nodes, pin membership as edges. No coordinates are
// stored; the client lays the graph out itself.
export default async function GraphPage() {
  const [usage, graph] = await Promise.all([getMeterUsage(), getDeviceGraph()])
  return (
    <Chassis meterUsage={usage} authEnabled={isClerkEnabled()} modelLabel={MODEL_LABEL}>
      <GraphView graph={graph} deviceName="MNT Reform" />
    </Chassis>
  )
}
