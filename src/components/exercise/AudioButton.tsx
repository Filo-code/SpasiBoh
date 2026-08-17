import { useAudio } from '@/hooks/useAudio'

interface Props {
  text: string
  /** Renders both the normal and the slow button. */
  showSlow?: boolean
  size?: 'sm' | 'md'
  className?: string
  autoPlay?: boolean
}

/**
 * 🔊 Normale / 🐢 Lento.
 *
 * Both buttons speak the same text at different rates using the browser's
 * Russian voice. If the device has no Russian voice we say so rather than
 * playing an Italian voice reading Cyrillic.
 */
export function AudioButton({ text, showSlow = true, size = 'md', className = '' }: Props) {
  const { play, speaking, supported, hasRussianVoice } = useAudio()

  if (!supported) {
    return (
      <p className={`text-xs text-ink-faint ${className}`}>
        Audio non disponibile in questo browser.
      </p>
    )
  }

  const base =
    size === 'sm'
      ? 'min-h-[40px] px-3 text-sm gap-1.5 rounded-lg'
      : 'min-h-[48px] px-4 text-[0.95rem] gap-2 rounded-xl'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => play(text, 'normal')}
          aria-label={`Ascolta la pronuncia normale di ${text}`}
          className={`inline-flex items-center border font-medium transition-colors ${base} ${
            speaking === 'normal'
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface-2 text-ink hover:border-border-strong'
          }`}
        >
          <span aria-hidden>🔊</span> Normale
        </button>
        {showSlow && (
          <button
            type="button"
            onClick={() => play(text, 'slow')}
            aria-label={`Ascolta la pronuncia lenta di ${text}`}
            className={`inline-flex items-center border font-medium transition-colors ${base} ${
              speaking === 'slow'
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-surface-2 text-ink hover:border-border-strong'
            }`}
          >
            <span aria-hidden>🐢</span> Lento
          </button>
        )}
      </div>
      {!hasRussianVoice && (
        <p className="text-[0.7rem] text-warn">
          Nessuna voce russa installata sul dispositivo: l&apos;audio potrebbe suonare male.
        </p>
      )}
    </div>
  )
}
