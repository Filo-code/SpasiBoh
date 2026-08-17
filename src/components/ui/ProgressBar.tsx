interface Props {
  /** 0..1 */
  value: number
  label?: string
  className?: string
  tone?: 'accent' | 'success' | 'warn' | 'danger'
  showValue?: boolean
}

const TONES = {
  accent: 'bg-accent',
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
}

export function ProgressBar({ value, label, className = '', tone = 'accent', showValue }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          {label && <span className="text-ink-muted">{label}</span>}
          {showValue && <span className="font-semibold tabular-nums">{pct}%</span>}
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${TONES[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
