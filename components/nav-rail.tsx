'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

// 18×18 line glyphs drawn in the chassis vernacular (board, log, node-link).
const ITEMS: NavItem[] = [
  {
    href: '/bench',
    label: 'Bench',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3.5" width="14" height="11" rx="2" />
        <rect x="6.5" y="6.5" width="5" height="5" rx="1" />
        <path d="M4.5 9h2M11.5 9h2M9 4.5v1.8M9 11.7v1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/repairs',
    label: 'Repairs',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="4" cy="4.5" r="1.1" />
        <circle cx="4" cy="9" r="1.1" />
        <circle cx="4" cy="13.5" r="1.1" />
        <path d="M7.5 4.5H15M7.5 9H13M7.5 13.5H14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/graph',
    label: 'Graph',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5.4 6.2 9 4M9 4l3.6 2.2M5 8.2l3.4 4.4M13 8.2l-3.4 4.4" strokeLinecap="round" />
        <circle cx="9" cy="3.4" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="4.4" cy="7.4" r="1.7" />
        <circle cx="13.6" cy="7.4" r="1.7" />
        <circle cx="9" cy="13.6" r="1.7" />
      </svg>
    ),
  },
  {
    href: '/fleet',
    label: 'Fleet',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 15h12" strokeLinecap="round" />
        <rect x="4" y="9" width="2.4" height="4.5" rx="0.6" />
        <rect x="7.8" y="5.5" width="2.4" height="8" rx="0.6" />
        <rect x="11.6" y="7.5" width="2.4" height="6" rx="0.6" />
      </svg>
    ),
  },
]

export function NavRail() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="flex h-full flex-col items-center gap-[6px] border-r-[1.5px] border-rule-strong bg-[linear-gradient(180deg,#efe9db,#e7e1d3)] py-[14px] after:hidden"
    >
      {ITEMS.map((it) => {
        const active = pathname.startsWith(it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? 'page' : undefined}
            title={it.label}
            className={`relative flex h-[44px] w-[44px] flex-col items-center justify-center gap-[3px] rounded-[9px] transition-colors ${
              active
                ? 'bg-[#fff7e9] text-flux shadow-[0_1px_0_#fff8ec_inset,0_8px_16px_-12px_#00000066]'
                : 'text-ink-3 hover:bg-[#0000000d] hover:text-ink-2s'
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-[-8px] top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full bg-flux shadow-[0_0_8px_var(--flux)]"
              />
            )}
            <span className="flex h-[18px] w-[18px] items-center justify-center">{it.icon}</span>
            <span className="font-mono text-[7px] uppercase tracking-[0.06em] leading-none">
              {it.label}
            </span>
          </Link>
        )
      })}

      <div className="flex-1" />

      <span
        aria-hidden
        className="rotate-180 font-mono text-[7.5px] tracking-[0.22em] text-ink-3 opacity-50 [writing-mode:vertical-rl]"
      >
        CONTINUITY
      </span>
    </nav>
  )
}
