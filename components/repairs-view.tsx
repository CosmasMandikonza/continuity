'use client'

import { useEffect, useState } from 'react'
import { getRepairDetailAction, confirmRootCauseAction } from '@/app/actions'
import type { RepairListItem, RepairDetail } from '@/lib/queries'

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function RepairsView({ repairs }: { repairs: RepairListItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(repairs[0]?.id ?? null)
  const [detail, setDetail] = useState<RepairDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let alive = true
    setLoading(true)
    getRepairDetailAction(selectedId).then((d) => {
      if (!alive) return
      setDetail(d)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [selectedId])

  return (
    <div className="grid min-h-0 gap-[14px] p-[14px] md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ── list ─────────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055]">
        <div className="flex items-center gap-2 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-3 py-[9px]">
          <span className="ucl text-[10px] text-ink-2s">Repairs</span>
          <span className="ml-auto font-mono text-[9px] text-ink-3">
            {repairs.length} {repairs.length === 1 ? 'RECORD' : 'RECORDS'}
          </span>
        </div>

        {repairs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="ucl text-[11px] text-ink-2s">No repairs yet</span>
            <span className="font-mono text-[10px] leading-[1.6] text-ink-3">
              Run your first diagnosis on the Bench. Every session is saved here with its
              measurements, root-cause finding, and verification.
            </span>
          </div>
        ) : (
          <ul className="log-scroll min-h-0 flex-1 overflow-y-auto">
            {repairs.map((r) => {
              const active = r.id === selectedId
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full flex-col gap-[5px] border-b border-rule px-3 py-[10px] text-left transition-colors ${
                      active ? 'bg-[#fff7e9]' : 'hover:bg-[#0000000a]'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] font-semibold text-ink">{r.ref}</span>
                      <StatusDot status={r.status} />
                      <span className="ml-auto font-mono text-[8.5px] text-ink-3">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                    <div className="truncate font-sans text-[11px] text-ink-2s">
                      {r.symptom ?? 'No symptom recorded'}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.findingRefdes ? (
                        <span className="font-mono text-[9.5px] text-flux-ink">
                          {r.findingRefdes}
                          {r.findingKind ? ` · ${r.findingKind.replace(/_/g, ' ')}` : ''}
                        </span>
                      ) : (
                        <span className="font-mono text-[9.5px] text-ink-3">no finding</span>
                      )}
                      {r.findingRefdes && <VerifyTag verified={r.findingVerified} small />}
                      {r.techName && (
                        <span className="ml-auto truncate font-mono text-[8.5px] text-ink-3">
                          {r.techName}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── detail ───────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[11px] border border-rule-2 bg-[linear-gradient(180deg,#f3eee2,#ece6d8)] shadow-[0_1px_0_#fff8ec_inset,0_14px_30px_-22px_#00000055]">
        {!selectedId ? (
          <EmptyDetail />
        ) : loading && !detail ? (
          <div className="flex flex-1 items-center justify-center font-mono text-[10px] tracking-[0.04em] text-ink-3">
            LOADING RECORD…
          </div>
        ) : detail ? (
          <RepairDetailPanel detail={detail} />
        ) : (
          <EmptyDetail note="Record not found." />
        )}
      </section>
    </div>
  )
}

function RepairDetailPanel({ detail }: { detail: RepairDetail }) {
  const finding = detail.findings[detail.findings.length - 1] ?? null
  return (
    <>
      <div className="flex items-center gap-3 border-b border-rule bg-[linear-gradient(180deg,#f6f1e6,#00000000)] px-4 py-[11px]">
        <span className="font-mono text-[13px] font-semibold text-ink">{detail.ref}</span>
        <StatusDot status={detail.status} withLabel />
        <span className="ml-auto font-mono text-[9px] text-ink-3">{detail.deviceName}</span>
      </div>

      <div className="log-scroll min-h-0 flex-1 overflow-y-auto px-4 py-[14px]">
        <div className="font-sans text-[12px] leading-[1.55] text-ink-2s">
          <span className="ucl mr-2 text-[9px] text-ink-3">Symptom</span>
          {detail.symptom ?? '—'}
        </div>

        {/* finding + verification */}
        {finding && (
          <div className="mt-[14px] rounded-[9px] border border-rule-2 bg-[#fff7e9] p-[12px]">
            <div className="flex items-center gap-2">
              <span className="ucl text-[9px] text-ink-3">Root cause</span>
              <VerifyTag verified={finding.verified} />
            </div>
            <div className="mt-[7px] flex items-baseline gap-[8px]">
              <span className="font-mono text-[18px] font-bold leading-none text-flux-ink">
                {finding.refdes ?? finding.net ?? '—'}
              </span>
              <span className="font-mono text-[11px] text-ink-2s">
                {finding.kind.replace(/_/g, ' ')}
              </span>
              {finding.confidence != null && (
                <span className="ml-auto font-mono text-[10px] text-ink-3">
                  conf {finding.confidence.toFixed(2)}
                </span>
              )}
            </div>
            <ConfirmRootCause key={finding.id} finding={finding} />
          </div>
        )}

        {/* measurements */}
        {detail.measurements.length > 0 && (
          <div className="mt-[16px]">
            <div className="ucl mb-[7px] text-[9px] text-ink-3">Measurements</div>
            <div className="overflow-hidden rounded-[8px] border border-rule">
              {detail.measurements.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-[11px] py-[7px] font-mono text-[10.5px] ${
                    i > 0 ? 'border-t border-rule' : ''
                  }`}
                >
                  <span className="text-ink">{m.target ?? '—'}</span>
                  <span className="text-ink-3">{m.kind}</span>
                  <span className="ml-auto tabular-nums text-ink-2s">
                    {m.value != null ? m.value : '—'}
                    {m.unit ? ` ${m.unit}` : ''}
                  </span>
                  {m.expected != null && (
                    <span className="tabular-nums text-ink-3">exp {m.expected}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* transcript */}
        {detail.messages.length > 0 && (
          <div className="mt-[16px]">
            <div className="ucl mb-[7px] text-[9px] text-ink-3">Transcript</div>
            <div className="flex flex-col gap-[10px]">
              {detail.messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-[3px]">
                  <span
                    className={`w-fit rounded-[4px] px-[6px] py-[1px] font-mono text-[8px] uppercase tracking-[0.1em] ${
                      m.role === 'tech'
                        ? 'bg-[#0000000d] text-ink-3'
                        : 'bg-flux/10 text-flux-ink'
                    }`}
                  >
                    {m.role}
                  </span>
                  <p className="whitespace-pre-wrap font-sans text-[11.5px] leading-[1.55] text-ink-2s">
                    {m.text || <span className="text-ink-3">—</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function EmptyDetail({ note }: { note?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="ucl text-[11px] text-ink-2s">{note ?? 'Select a repair'}</span>
      <span className="font-mono text-[10px] text-ink-3">
        Its transcript, measurements, and verified finding appear here.
      </span>
    </div>
  )
}

function StatusDot({
  status,
  withLabel,
}: {
  status: string
  withLabel?: boolean
}) {
  const resolved = status === 'resolved'
  return (
    <span className="flex items-center gap-[5px]">
      <span
        className={`h-[6px] w-[6px] rounded-full ${
          resolved
            ? 'bg-phos shadow-[0_0_6px_#39f0a3]'
            : 'bg-caution shadow-[0_0_6px_#ffc24d]'
        }`}
      />
      {withLabel && (
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">{status}</span>
      )}
    </span>
  )
}

function VerifyTag({ verified, small }: { verified: boolean | null; small?: boolean }) {
  const size = small ? 'text-[8px] px-[5px] py-[1px]' : 'text-[9px] px-[7px] py-[2px]'
  if (verified === true) {
    return (
      <span
        className={`rounded-[4px] bg-[#1f7a52]/12 font-mono uppercase tracking-[0.08em] text-[#1f7a52] ${size}`}
      >
        verified ✓
      </span>
    )
  }
  if (verified === false) {
    return (
      <span
        className={`rounded-[4px] bg-probe/12 font-mono uppercase tracking-[0.08em] text-probe ${size}`}
      >
        ⚠ unverified
      </span>
    )
  }
  return (
    <span
      className={`rounded-[4px] bg-[#0000000d] font-mono uppercase tracking-[0.08em] text-ink-3 ${size}`}
    >
      not checked
    </span>
  )
}

function ConfirmRootCause({ finding }: { finding: RepairFinding }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>(
    finding.status === 'confirmed' ? 'done' : 'idle',
  )
  const [err, setErr] = useState<string | null>(null)

  // Only a verified, not-yet-confirmed finding can be promoted into shop memory.
  if (state !== 'done' && finding.verified !== true) return null

  if (state === 'done') {
    return (
      <div className="mt-[11px] flex items-center gap-2 rounded-[7px] border border-[#1f7a52]/25 bg-[#1f7a52]/12 px-[10px] py-[7px]">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#1f7a52]">
          ✓ confirmed · in shop memory
        </span>
        <span className="ml-auto font-mono text-[8.5px] text-ink-3">pgvector · embedded</span>
      </div>
    )
  }

  return (
    <div className="mt-[11px]">
      <button
        type="button"
        disabled={state === 'saving'}
        onClick={async () => {
          setState('saving')
          setErr(null)
          const res = await confirmRootCauseAction(finding.id)
          if (res.ok) setState('done')
          else {
            setState('error')
            setErr(res.error ?? 'Failed to confirm.')
          }
        }}
        className="flex items-center gap-[7px] rounded-[7px] border border-flux/40 bg-flux/10 px-[11px] py-[7px] font-mono text-[10px] text-flux-ink transition-colors hover:bg-flux/20 disabled:opacity-60"
      >
        <span className="text-[12px] leading-none">+</span>
        {state === 'saving' ? 'EMBEDDING INTO SHOP MEMORY…' : 'Confirm root cause → shop memory'}
      </button>
      {state === 'error' && <div className="mt-[5px] font-mono text-[9px] text-probe">{err}</div>}
    </div>
  )
}
