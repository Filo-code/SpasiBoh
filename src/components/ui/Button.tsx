import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 active:bg-accent/80 disabled:bg-accent/40 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
  secondary:
    'bg-surface-2 text-ink border border-border hover:border-border-strong hover:bg-surface-2/80',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2/60',
  danger: 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25',
  success: 'bg-success text-[#04231a] hover:bg-success/90',
}

const SIZES: Record<Size, string> = {
  sm: 'text-sm px-3 py-2 rounded-lg min-h-[40px]',
  md: 'text-[0.95rem] px-4 py-3 rounded-xl min-h-[48px]',
  lg: 'text-base px-5 py-4 rounded-2xl min-h-[56px] font-semibold',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  icon?: ReactNode
  /** React 19 passes refs as plain props for function components. */
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  className = '',
  children,
  ref,
  ...rest
}: Props) {
  return (
    <button
      ref={ref}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
