import type { ReactNode } from 'react'

interface Props {
  icon?: string
  label: string
  value: ReactNode
  hint?: string
  className?: string
}

export function StatCard({ icon, label, value, hint, className = '' }: Props) {
  return (
    <div className={`card px-3.5 py-3 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-ink-faint">
        {icon && (
          <span aria-hidden className="text-sm">
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold leading-none tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[0.7rem] text-ink-faint">{hint}</div>}
    </div>
  )
}
