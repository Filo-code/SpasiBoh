import { useEffect, useMemo, useState } from 'react'

interface Props {
  /** Shuffled pool presented to the user. */
  blocks: string[]
  answered: boolean
  correct: boolean | null
  onChange(selected: string[]): void
  /** Reset signal — change it to clear the tray. */
  resetKey: string
  /** Renders single characters larger (word-spelling mode). */
  compact?: boolean
}

/**
 * Tap-to-build sentence tray.
 *
 * Tapping a block moves it into the answer row; tapping it there sends it
 * back. Duplicated words are handled by tracking indices, not values.
 */
export function WordBlocks({ blocks, answered, correct, onChange, resetKey, compact }: Props) {
  const [chosen, setChosen] = useState<number[]>([])

  useEffect(() => {
    setChosen([])
  }, [resetKey])

  useEffect(() => {
    onChange(chosen.map((index) => blocks[index]))
    // `onChange` is recreated by the parent on every render; depending on it
    // would loop. The selection is the only thing that should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, blocks])

  // The pool can legitimately contain the same word twice ("два" appearing as
  // both a solution block and a distractor), so each slot gets a stable id of
  // its own rather than being keyed by its text.
  const pool = useMemo(
    () => blocks.map((block, index) => ({ id: `${index}:${block}`, block, index })),
    [blocks],
  )

  const add = (index: number) => {
    if (answered || chosen.includes(index)) return
    setChosen((prev) => [...prev, index])
  }

  const remove = (index: number) => {
    if (answered) return
    setChosen((prev) => prev.filter((i) => i !== index))
  }

  const trayTone =
    answered && correct === true
      ? 'border-success bg-success-soft'
      : answered && correct === false
        ? 'border-danger bg-danger-soft'
        : 'border-border-strong bg-bg-soft'

  const blockClass = compact
    ? 'px-3 py-2 text-xl min-h-[48px] min-w-[48px] justify-center'
    : 'px-3.5 py-2.5 text-lg min-h-[48px]'

  return (
    <div className="space-y-3">
      <div
        className={`flex min-h-[72px] flex-wrap content-start items-start gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${trayTone}`}
        aria-live="polite"
        aria-label="La tua risposta"
      >
        {chosen.length === 0 && (
          <span className="self-center text-sm text-ink-faint">
            Tocca i blocchi qui sotto per comporre la frase
          </span>
        )}
        {chosen.map((blockIndex) => (
          <button
            key={`chosen-${blockIndex}`}
            type="button"
            disabled={answered}
            onClick={() => remove(blockIndex)}
            aria-label={`Rimuovi ${blocks[blockIndex]}`}
            className={`cyr inline-flex items-center rounded-lg border border-accent/50 bg-accent-soft font-semibold text-ink transition-colors hover:border-accent disabled:opacity-80 ${blockClass}`}
          >
            {blocks[blockIndex]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Blocchi disponibili">
        {pool.map(({ id, block, index }) => {
          const used = chosen.includes(index)
          return (
            <button
              key={id}
              type="button"
              disabled={answered || used}
              onClick={() => add(index)}
              aria-label={block}
              className={[
                'cyr inline-flex items-center rounded-lg border font-semibold transition-colors',
                blockClass,
                used
                  ? 'invisible'
                  : 'border-border bg-surface-2 text-ink hover:border-border-strong active:scale-[0.97]',
              ].join(' ')}
            >
              {block}
            </button>
          )
        })}
      </div>
    </div>
  )
}
