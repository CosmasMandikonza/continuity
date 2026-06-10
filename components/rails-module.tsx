import { RAILS } from '@/lib/wrenchboard-data'

const pinClass: Record<string, string> = {
  ok: 'bg-phos shadow-[0_0_8px_#39f0a3]',
  warn: 'bg-caution shadow-[0_0_8px_#ffc24d]',
  dead: 'animate-blink bg-probe shadow-[0_0_9px_#ff5247]',
}
const valClass: Record<string, string> = {
  ok: 'text-[#1f7a52]',
  warn: 'text-[#9a6a00]',
  dead: 'text-flux-ink',
}

export function RailsModule() {
  return (
    <section
      className="hidden min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055] md:flex"
      aria-label="Power rails"
    >
      <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
        <span className="ucl text-[10px] text-ink-2s">Rails</span>
        <span className="ml-auto font-mono text-[9px] text-ink-3">DC</span>
      </div>
      <div className="px-[10px] pb-[10px] pt-[6px]">
        {RAILS.map((rail, i) => (
          <div
            key={rail.name}
            className={`flex items-center gap-[9px] px-[2px] py-[9px] ${
              i < RAILS.length - 1 ? 'border-b border-dashed border-rule' : ''
            }`}
          >
            <span className={`h-2 w-2 flex-none rounded-full ${pinClass[rail.state]}`} />
            <span className="flex-1 font-mono text-[10.5px] tracking-[-0.02em] text-ink-2s">
              {rail.name}
            </span>
            <span className={`font-mono text-[11px] font-semibold ${valClass[rail.state]}`}>
              {rail.value}
            </span>
          </div>
        ))}
        <div className="mt-[11px] font-mono text-[8.5px] leading-[1.5] tracking-[0.02em] text-ink-3">
          PROBE · BENCH PSU
          <br />
          500&nbsp;mA LIMIT · 25°C
        </div>
      </div>
    </section>
  )
}
