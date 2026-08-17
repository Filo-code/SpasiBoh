import { useEffect, useState } from 'react'
import { formatDuration } from '@/utils/time'

interface Props {
  startedAt: number
  /** Optional soft budget; the label turns amber past it but nothing fails. */
  budgetMs?: number
  className?: string
  label?: string
  paused?: boolean
}

/**
 * Elapsed-time display.
 *
 * Deliberately non-punitive: exceeding the warm-up budget only changes the
 * colour, it never ends an exercise (see the README note on timers).
 */
export function Timer({ startedAt, budgetMs, className = '', label, paused }: Props) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (paused) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [paused])

  const elapsed = Math.max(0, now - startedAt)
  const overBudget = budgetMs !== undefined && elapsed > budgetMs

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 tabular-nums ${className}`}
      aria-label={label ?? 'Tempo trascorso'}
    >
      <span aria-hidden className="text-ink-faint">
        ⏱
      </span>
      <span className={overBudget ? 'font-semibold text-warn' : 'font-semibold text-ink-muted'}>
        {formatDuration(elapsed)}
      </span>
      {budgetMs !== undefined && (
        <span className="text-ink-faint/70">/ {formatDuration(budgetMs)}</span>
      )}
    </span>
  )
}
