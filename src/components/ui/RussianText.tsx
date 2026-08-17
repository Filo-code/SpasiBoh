interface Props {
  children: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero'
  className?: string
  /** Announce as Russian to screen readers. */
  lang?: boolean
}

const SIZES = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
  hero: 'text-[clamp(3.5rem,22vw,7rem)] leading-none',
}

/**
 * Cyrillic display text. Kept as its own component so the font stack and
 * `lang` attribute are consistent everywhere — screen readers need `lang="ru"`
 * to switch pronunciation.
 */
export function RussianText({ children, size = 'md', className = '', lang = true }: Props) {
  return (
    <span
      lang={lang ? 'ru' : undefined}
      className={`cyr font-bold ${SIZES[size]} ${className}`}
    >
      {children}
    </span>
  )
}
