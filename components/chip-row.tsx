'use client'

import { useRef } from 'react'
import type { ROWS, Segment } from '@/lib/wrenchboard-data'

interface ChipRowProps {
  segments: Segment[]
  onOpen: (key: keyof typeof ROWS, rect: DOMRect) => void
  onClose: () => void
}

const chipClass: Record<string, string> = {
  cite: 'text-[#1162a8] border-[#a9cdec] bg-[#e8f1fa] cursor-help',
  net: 'text-[#1f7a52] border-[#9fd9bf] bg-[#e9f7ef] cursor-help',
  sym: 'text-flux-ink border-[#e6b99a] bg-[#fbe7da]',
  act: 'text-flux border-[#e6a273] bg-[#fbe1d3] font-medium',
}

export function ChipRow({ segments, onOpen, onClose }: ChipRowProps) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.t === 'text') return <span key={i}>{seg.text}</span>

        if (seg.kind === 'bal') {
          return (
            <span
              key={i}
              className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border border-phos bg-phos px-[6px] py-[2px] align-baseline font-mono text-[10.5px] font-bold leading-none text-[#0c130f]"
            >
              {seg.label}
            </span>
          )
        }

        const interactive = (seg.kind === 'cite' || seg.kind === 'net') && !!seg.prov
        return (
          <Chip
            key={i}
            label={seg.label}
            kind={seg.kind}
            prov={seg.prov}
            interactive={interactive}
            onOpen={onOpen}
            onClose={onClose}
          />
        )
      })}
    </>
  )
}

function Chip({
  label,
  kind,
  prov,
  interactive,
  onOpen,
  onClose,
}: {
  label: string
  kind: string
  prov?: keyof typeof ROWS
  interactive: boolean
  onOpen: (key: keyof typeof ROWS, rect: DOMRect) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLSpanElement>(null)

  const handleOpen = () => {
    if (interactive && prov && ref.current) {
      onOpen(prov, ref.current.getBoundingClientRect())
    }
  }

  const showDot = kind === 'cite'

  return (
    <span
      ref={ref}
      tabIndex={interactive ? 0 : undefined}
      onMouseEnter={interactive ? handleOpen : undefined}
      onMouseLeave={interactive ? onClose : undefined}
      onFocus={interactive ? handleOpen : undefined}
      onBlur={interactive ? onClose : undefined}
      className={`relative inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border px-[6px] py-[2px] align-baseline font-mono text-[10.5px] leading-none ${chipClass[kind] ?? ''}`}
    >
      {showDot && (
        <span className="h-[5px] w-[5px] rounded-full bg-[#2f86d6]" aria-hidden />
      )}
      {label}
    </span>
  )
}
