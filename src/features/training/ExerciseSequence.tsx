import { useCallback, useMemo, useState } from 'react'
import type { AnswerResult, Exercise } from '@/types/exercise'
import { ExerciseRunner } from '@/components/exercise/ExerciseRunner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/store/appStore'
import { parseItemKey } from '@/types/progress'

export interface SequenceOutcome {
  correct: number
  total: number
  /** Item keys answered wrong at least once. */
  wrongKeys: string[]
  durationMs: number
}

interface Props {
  exercises: Exercise[]
  onComplete(outcome: SequenceOutcome): void
  /** Rendered above the progress bar. */
  header?: React.ReactNode
  finalLabel?: string
}

/**
 * Runs a fixed list of exercises, persisting every answer as it happens.
 *
 * Answers are written immediately rather than at the end, so closing the app
 * mid-session never loses work.
 */
export function ExerciseSequence({ exercises, onComplete, header, finalLabel = 'Continua' }: Props) {
  const recordAnswer = useAppStore((state) => state.recordAnswer)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrongKeys, setWrongKeys] = useState<string[]>([])
  const [startedAt] = useState(() => Date.now())

  const current = exercises[index]
  const isLast = index >= exercises.length - 1

  const handleAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!current) return
      const { kind, id } = parseItemKey(current.itemKey)
      if (result.correct) setCorrect((value) => value + 1)
      else setWrongKeys((keys) => [...keys, current.itemKey])

      await recordAnswer({
        kind,
        id,
        correct: result.correct,
        exerciseType: current.type,
        elapsedMs: Math.min(result.elapsedMs, 120_000),
        skipped: result.skipped,
      })
    },
    [current, recordAnswer],
  )

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete({
        correct,
        total: exercises.length,
        wrongKeys,
        durationMs: Date.now() - startedAt,
      })
      return
    }
    setIndex((value) => value + 1)
  }, [correct, exercises.length, isLast, onComplete, startedAt, wrongKeys])

  const progress = useMemo(
    () => (exercises.length === 0 ? 0 : index / exercises.length),
    [exercises.length, index],
  )

  if (!current) return null

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5">
        {header}
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={progress} className="flex-1" />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-faint">
            {index + 1}/{exercises.length}
          </span>
        </div>
      </div>

      <ExerciseRunner
        key={current.uid}
        exercise={current}
        onAnswered={handleAnswered}
        onNext={handleNext}
        nextLabel={isLast ? finalLabel : 'Continua'}
      />
    </div>
  )
}
