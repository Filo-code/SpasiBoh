import type { Reveal } from '@/types/exercise'
import { AudioButton } from './AudioButton'
import { RussianText } from '@/components/ui/RussianText'

interface Props {
  correct: boolean
  reveal: Reveal
  /** What the user actually produced (speech transcript / assembled sentence). */
  given?: string
  /** Extra line, e.g. the microphone caveat. */
  note?: string
  skipped?: boolean
}

/**
 * The panel shown *after* an attempt. This is the only place where
 * transliteration, translation and audio appear — never before the answer.
 */
export function ResultFeedback({ correct, reveal, given, note, skipped }: Props) {
  const tone = skipped
    ? { border: 'border-border-strong', bg: 'bg-surface-2', text: 'text-ink', icon: '•', label: 'Saltato' }
    : correct
      ? { border: 'border-success/50', bg: 'bg-success-soft', text: 'text-success', icon: '✓', label: 'Corretto' }
      : { border: 'border-danger/50', bg: 'bg-danger-soft', text: 'text-danger', icon: '✗', label: 'Sbagliato' }

  return (
    <div
      className={`animate-rise rounded-2xl border ${tone.border} ${tone.bg} p-4`}
      role="status"
      aria-live="polite"
    >
      <div className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wide ${tone.text}`}>
        <span aria-hidden className="text-lg leading-none">
          {tone.icon}
        </span>
        {tone.label}
      </div>

      {given && (
        <p className="mt-2 text-sm text-ink-muted">
          Hai detto: <span className="cyr font-semibold text-ink">{given}</span>
        </p>
      )}

      <div className="mt-3 space-y-1.5">
        <RussianText size="md" className="block">
          {reveal.stressed || reveal.russian}
        </RussianText>
        <p className="text-sm text-ink-muted">
          <span aria-hidden>🗣 </span>
          <span className="font-medium text-ink">{reveal.transliteration}</span>
        </p>
        <p className="text-sm text-ink-muted">
          <span aria-hidden>🇮🇹 </span>
          <span className="text-ink">{reveal.italian}</span>
        </p>
      </div>

      {reveal.example && (
        <p className="mt-3 border-t border-white/5 pt-3 text-sm">
          <span className="text-ink-faint">Esempio: </span>
          <span className="cyr text-ink">{reveal.example}</span>
          {reveal.exampleItalian && (
            <span className="text-ink-faint"> — {reveal.exampleItalian}</span>
          )}
        </p>
      )}

      {reveal.note && <p className="mt-2 text-xs text-ink-faint">ℹ️ {reveal.note}</p>}
      {note && <p className="mt-2 text-xs text-ink-faint">{note}</p>}

      <AudioButton text={reveal.audioText} className="mt-3" size="sm" />
    </div>
  )
}
