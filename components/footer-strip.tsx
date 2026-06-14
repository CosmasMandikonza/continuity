interface FooterStripProps {
  busy: boolean
}

export function FooterStrip({ busy }: FooterStripProps) {
  return (
    <footer className="flex items-center border-t-[1.5px] border-rule-strong bg-[linear-gradient(180deg,#00000000,#efe9db)] font-mono text-[9.5px] text-ink-3">
      <span className="flex items-center gap-[7px] border-r border-rule px-[14px] py-2">
        <span
          className={`h-[6px] w-[6px] rounded-full ${
            busy ? 'animate-pulse-dot bg-phos shadow-[0_0_8px_#39f0a3]' : 'bg-[#c9c0ad]'
          }`}
        />
        {busy ? 'piloting board' : 'idle'}
      </span>
      <span className="flex items-center gap-[7px] border-r border-rule px-[14px] py-2">
        device&nbsp;<b className="font-semibold text-ink-2s">MNT Reform r3</b>
      </span>
      <span className="hidden items-center gap-[7px] border-r border-rule px-[14px] py-2 sm:flex">
        graph&nbsp;<b className="font-semibold text-ink-2s">electrical_graph</b>
      </span>
      <div className="ml-auto flex">
        <span className="hidden items-center gap-[7px] border-r border-rule px-[14px] py-2 sm:flex">
          verifier&nbsp;<b className="font-semibold text-[#1f7a52]">deterministic</b>
        </span>
        <span className="hidden items-center gap-[7px] border-r border-rule px-[14px] py-2 md:flex">
          store&nbsp;<b className="font-semibold text-ink-2s">Aurora · pgvector</b>
        </span>
        <span className="flex items-center gap-[7px] px-[14px] py-2">
          PP5V0&nbsp;<b className="font-semibold text-flux-ink">0.31 V</b>
        </span>
      </div>
    </footer>
  )
}
