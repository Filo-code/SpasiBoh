import type { HTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`card p-4 ${className}`} {...rest}>
      {children}
    </div>
  )
}

interface SectionProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function Section({ title, action, children, className = '' }: SectionProps) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

interface TileProps {
  to: string
  icon: string
  label: string
  hint?: string
  badge?: string | number
}

/** Big touch target used by the "Allenamento libero" grid. */
export function Tile({ to, icon, label, hint, badge }: TileProps) {
  return (
    <Link
      to={to}
      className="card group flex min-h-[92px] flex-col justify-between p-3.5 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 focus-visible:border-accent"
    >
      <div className="flex items-start justify-between">
        <span aria-hidden className="text-2xl leading-none">
          {icon}
        </span>
        {badge !== undefined && badge !== 0 && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold text-accent">
            {badge}
          </span>
        )}
      </div>
      <div>
        <div className="text-[0.95rem] font-semibold leading-tight">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
      </div>
    </Link>
  )
}
