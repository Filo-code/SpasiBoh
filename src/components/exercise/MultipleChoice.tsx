import type { ChoiceOption } from '@/types/exercise'
import { RussianText } from '@/components/ui/RussianText'

interface Props {
  options: ChoiceOption[]
  selectedId: string | null
  answered: boolean
  onSelect(option: ChoiceOption): void
  disabled?: boolean
}

/**
 * Answer buttons.
 *
 * Correctness is never communicated by colour alone: the chosen option also
 * gets an explicit ✓ / ✗ glyph and an `aria-label` suffix, so the feedback
 * survives both colour blindness and a screen reader.
 */
export function MultipleChoice({ options, selectedId, answered, onSelect, disabled }: Props) {
  return (
    <div role="group" aria-label="Risposte possibili" className="grid gap-2.5">
      {options.map((option) => {
        const isSelected = option.id === selectedId
        const revealCorrect = answered && option.correct
        const revealWrong = answered && isSelected && !option.correct

        let tone = 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
        if (revealCorrect) tone = 'border-success bg-success-soft text-success'
        else if (revealWrong) tone = 'border-danger bg-danger-soft text-danger'
        else if (answered) tone = 'border-border bg-surface opacity-55'
        else if (isSelected) tone = 'border-accent bg-accent-soft'

        const suffix = revealCorrect ? ' — risposta corretta' : revealWrong ? ' — risposta errata' : ''

        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled || answered}
            onClick={() => onSelect(option)}
            aria-label={`${option.label}${suffix}`}
            aria-pressed={isSelected}
            className={[
              'tap-target flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left',
              'transition-colors duration-150 disabled:cursor-default',
              revealWrong ? 'animate-shake' : '',
              tone,
            ].join(' ')}
          >
            {option.cyrillic ? (
              <RussianText size="sm" className="font-semibold">
                {option.label}
              </RussianText>
            ) : (
              <span className="text-[1.02rem] font-medium">{option.label}</span>
            )}

            {answered && (revealCorrect || revealWrong) && (
              <span aria-hidden className="shrink-0 text-lg font-bold">
                {revealCorrect ? '✓' : '✗'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
