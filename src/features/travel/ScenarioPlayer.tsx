import { useCallback, useMemo, useRef, useState } from 'react'
import type { Scenario } from '@/types/content'
import type { AnswerResult } from '@/types/exercise'
import { ExerciseRunner } from '@/components/exercise/ExerciseRunner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Button } from '@/components/ui/Button'
import { AudioButton } from '@/components/exercise/AudioButton'
import { RussianText } from '@/components/ui/RussianText'
import { useAppStore } from '@/store/appStore'
import { createRng, seedFromString } from '@/utils/random'
import { isRecognitionSupported } from '@/services/recognition'
import { scenarioStepToExercise } from './scenarioExercises'
import { parseItemKey } from '@/types/progress'

export interface ScenarioOutcome {
  correct: number
  total: number
  wrongKeys: string[]
  durationMs: number
}

interface Props {
  scenario: Scenario
  onComplete(outcome: ScenarioOutcome): void
  finalLabel?: string
}

/**
 * Plays a scenario as a small conversation: the NPC line is shown (and
 * spoken), then the step's exercise is presented. Once answered, the NPC line
 * gets its translation revealed and the dialogue moves on.
 */
export function ScenarioPlayer({ scenario, onComplete, finalLabel = 'Continua' }: Props) {
  const recordAnswer = useAppStore((state) => state.recordAnswer)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [wrongKeys, setWrongKeys] = useState<string[]>([])
  const [startedAt] = useState(() => Date.now())
  const rngRef = useRef(createRng(seedFromString(`scenario-${scenario.id}-${Date.now()}`)))
  const allowSpeech = useMemo(() => isRecognitionSupported(), [])

  const step = scenario.steps[index]
  const isLast = index >= scenario.steps.length - 1

  const exercise = useMemo(() => {
    if (!step) return null
    return scenarioStepToExercise(scenario, step, rngRef.current, allowSpeech)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, step?.id, allowSpeech])

  const advance = useCallback(() => {
    if (isLast) {
      onComplete({ correct, total, wrongKeys, durationMs: Date.now() - startedAt })
      return
    }
    setIndex((value) => value + 1)
  }, [correct, isLast, onComplete, startedAt, total, wrongKeys])

  const handleAnswered = useCallback(
    async (result: AnswerResult) => {
      if (!exercise) return
      setTotal((value) => value + 1)
      if (result.correct) setCorrect((value) => value + 1)
      else setWrongKeys((keys) => [...keys, exercise.itemKey])

      const { kind, id } = parseItemKey(exercise.itemKey)
      await recordAnswer({
        kind,
        id,
        correct: result.correct,
        exerciseType: exercise.type,
        elapsedMs: Math.min(result.elapsedMs, 120_000),
        skipped: result.skipped,
      })
    },
    [exercise, recordAnswer],
  )

  if (!step) return null

  const showNpcLine = step.kind !== 'comprehension' && Boolean(step.npcRussian)

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-xl">
            {scenario.icon}
          </span>
          <h1 className="text-base font-bold">{scenario.title}</h1>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar value={index / scenario.steps.length} className="flex-1" />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-faint">
            {index + 1}/{scenario.steps.length}
          </span>
        </div>
      </div>

      {showNpcLine && (
        <div className="mb-5 rounded-2xl rounded-bl-sm border border-border bg-surface-2 p-3.5">
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-ink-faint">
            Interlocutore
          </p>
          <RussianText size="sm" className="block">
            {step.npcRussian!}
          </RussianText>
          {step.npcItalian && <p className="mt-1 text-sm text-ink-muted">{step.npcItalian}</p>}
          <AudioButton text={step.npcRussian!} size="sm" className="mt-2.5" />
        </div>
      )}

      {step.kind === 'info' || !exercise ? (
        <div className="flex flex-1 flex-col justify-between">
          <p className="text-base leading-relaxed text-ink-muted">{step.prompt}</p>
          <Button fullWidth size="lg" onClick={advance} className="mt-6">
            {isLast ? finalLabel : 'Continua'}
          </Button>
        </div>
      ) : (
        <ExerciseRunner
          key={exercise.uid}
          exercise={exercise}
          onAnswered={handleAnswered}
          onNext={advance}
          nextLabel={isLast ? finalLabel : 'Continua'}
        />
      )}
    </div>
  )
}
