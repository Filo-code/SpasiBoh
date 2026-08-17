import { MASTERY_LABELS, masteryLevel, type MasteryLevel } from '@/engine/mastery'

const STYLES: Record<MasteryLevel, string> = {
  nuovo: 'bg-surface-2 text-ink-faint border-border',
  debole: 'bg-danger-soft text-danger border-danger/40',
  'in-corso': 'bg-warn/10 text-warn border-warn/40',
  buono: 'bg-accent-soft text-accent border-accent/40',
  padroneggiato: 'bg-success-soft text-success border-success/40',
}

interface Props {
  mastery: number
  seenCount?: number
  className?: string
}

export function MasteryBadge({ mastery, seenCount = 1, className = '' }: Props) {
  const level = masteryLevel(mastery, seenCount)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${STYLES[level]} ${className}`}
    >
      {MASTERY_LABELS[level]}
    </span>
  )
}
