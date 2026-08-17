import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnswerResult } from '@/types/exercise'
import { ALPHABET_BY_ID } from '@/data/alphabet'
import { ExerciseRunner } from '@/components/exercise/ExerciseRunner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Timer } from '@/components/session/Timer'
import { useAppStore } from '@/store/appStore'
import { buildLetterExercise } from '@/engine/exerciseFactory'
import { buildLetterQueue } from '@/engine/scheduler'
import { createRng, seedFromString } from '@/utils/random'
import { isRecognitionSupported } from '@/services/recognition'

export interface AlphabetOutcome {
  correct: number
  total: number
  wrongLetterIds: string[]
  durationMs: number
  /** True when the target was reached rather than the user bailing out. */
  reachedTarget: boolean
}

interface Props {
  /** Pre-computed queue; the trainer extends it if the user needs more turns. */
  queue: string[]
  /** Correct answers required to finish. */
  target: number
  /** Soft time budget (ms). Only used for the timer colour. */
  budgetMs?: number
  onComplete(outcome: AlphabetOutcome): void
  title?: string
  subtitle?: string
  /** Shows a "salta" escape hatch — used by free training, not the warm-up. */
  allowSkip?: boolean
}

/**
 * The alphabet drill.
 *
 * Runs until `target` correct answers are reached. Letters are drawn from a
 * weighted queue that favours the ones you keep getting wrong, and the queue
 * is regenerated on the fly if you exhaust it — so a bad run gets *more*
 * practice on the weak letters rather than being cut short.
 */
export function AlphabetTrainer({
  queue,
  target,
  budgetMs,
  onComplete,
  title,
  subtitle,
  allowSkip,
}: Props) {
  const recordAnswer = useAppStore((state) => state.recordAnswer)
  const itemsByKey = useAppStore((state) => state.itemsByKey)
  const progressFor = useAppStore((state) => state.progressFor)

  const [letterQueue, setLetterQueue] = useState<string[]>(queue)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [wrongIds, setWrongIds] = useState<string[]>([])
  const [startedAt] = useState(() => Date.now())
  const rngRef = useRef(createRng(seedFromString(`alfabeto-${Date.now()}`)))
  const allowSpeech = useMemo(() => isRecognitionSupported(), [])

  useEffect(() => {
    setLetterQueue(queue)
    setIndex(0)
  }, [queue])

  // Ran out of scheduled letters before hitting the target: extend the queue,
  // biased towards whatever just went wrong.
  useEffect(() => {
    if (index < letterQueue.length - 1) return
    if (correct >= target) return
    const extension = buildLetterQueue(
      wrongIds.length > 0 ? [...new Set(wrongIds)] : letterQueue,
      itemsByKey,
      rngRef.current,
      12,
    )
    setLetterQueue((prev) => [...prev, ...extension])
  }, [correct, index, itemsByKey, letterQueue, target, wrongIds])

  const letterId = letterQueue[index]
  const letter = letterId ? ALPHABET_BY_ID[letterId] : undefined

  const exercise = useMemo(() => {
    if (!letter) return null
    return buildLetterExercise(letter, progressFor('letter', letter.id), rngRef.current, {
      allowSpeech,
    })
    // A new exercise per position in the queue; `progressFor` reads the latest
    // store value at build time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id, index, allowSpeech])

  const finish = useCallback(
    (reachedTarget: boolean) => {
      onComplete({
        correct,
        total,
        wrongLetterIds: [...new Set(wrongIds)],
        durationMs: Date.now() - startedAt,
        reachedTarget,
      })
    },
    [correct, onComplete, startedAt, total, wrongIds],
  )

  const handleAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!letter) return
      setTotal((value) => value + 1)
      if (result.correct) setCorrect((value) => value + 1)
      else setWrongIds((ids) => [...ids, letter.id])

      await recordAnswer({
        kind: 'letter',
        id: letter.id,
        correct: result.correct,
        exerciseType: exercise?.type ?? 'letter-sound',
        elapsedMs: Math.min(result.elapsedMs, 120_000),
        skipped: result.skipped,
      })
    },
    [exercise?.type, letter, recordAnswer],
  )

  const handleNext = useCallback(() => {
    if (correct >= target) {
      finish(true)
      return
    }
    setIndex((value) => value + 1)
  }, [correct, finish, target])

  if (!exercise) return null

  const reached = correct >= target
  const inReviewRound = wrongIds.length > 0 && total >= target

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">{title ?? 'Alfabeto'}</h1>
            {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
            {inReviewRound && !reached && (
              <p className="mt-1 text-xs font-semibold text-warn">
                Ripasso errori — priorità alle lettere sbagliate
              </p>
            )}
          </div>
          <Timer startedAt={startedAt} budgetMs={budgetMs} />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ProgressBar
            value={Math.min(1, correct / target)}
            className="flex-1"
            tone={reached ? 'success' : 'accent'}
          />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-faint">
            {Math.min(correct, target)}/{target}
          </span>
        </div>

        {reached && (
          <p className="mt-2 text-xs font-semibold text-success">
            Obiettivo raggiunto — puoi continuare quando vuoi.
          </p>
        )}
      </div>

      <ExerciseRunner
        key={exercise.uid}
        exercise={exercise}
        onAnswered={handleAnswered}
        onNext={handleNext}
        nextLabel={reached ? 'Vai avanti' : 'Continua'}
      />

      {allowSkip && total > 0 && (
        <button
          type="button"
          onClick={() => finish(reached)}
          className="mt-4 text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted"
        >
          Termina allenamento
        </button>
      )}
    </div>
  )
}
