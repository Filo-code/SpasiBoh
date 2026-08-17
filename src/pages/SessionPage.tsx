import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SessionRecord, SessionStageId, SessionStageResult } from '@/types/progress'
import type { Exercise } from '@/types/exercise'
import { buildReviewExercises, buildSessionPlan, STAGE_TITLES, type SessionPlan } from '@/engine/session'
import { saveSession } from '@/db/progressRepo'
import { useAppStore } from '@/store/appStore'
import { AlphabetTrainer, type AlphabetOutcome } from '@/features/alphabet/AlphabetTrainer'
import { ExerciseSequence, type SequenceOutcome } from '@/features/training/ExerciseSequence'
import { ScenarioPlayer, type ScenarioOutcome } from '@/features/travel/ScenarioPlayer'
import { SessionRecap } from '@/features/review/SessionRecap'
import { SessionProgress } from '@/components/session/SessionProgress'
import { Timer } from '@/components/session/Timer'
import { Button } from '@/components/ui/Button'
import { isRecognitionSupported } from '@/services/recognition'
import { createRng, seedFromString } from '@/utils/random'
import { itemKey } from '@/types/progress'

type Phase = 'loading' | SessionStageId | 'recap'

/**
 * The guided daily session.
 *
 * Warm-up → Parole → Ascolto → Frasi → Viaggio → Ripasso. Each stage reports
 * its own result; the review stage is generated from the mistakes actually
 * made during the session, so it is different every time.
 */
export function SessionPage() {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  const itemsByKey = useAppStore((state) => state.itemsByKey)
  const streakBefore = useRef(useAppStore.getState().stats.currentStreak)

  const [phase, setPhase] = useState<Phase>('loading')
  const [plan, setPlan] = useState<SessionPlan | null>(null)
  const [results, setResults] = useState<SessionStageResult[]>([])
  const [weakKeys, setWeakKeys] = useState<string[]>([])
  const [reviewExercises, setReviewExercises] = useState<Exercise[]>([])
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)

  const allowSpeech = useMemo(
    () => settings.pronunciationEnabled && isRecognitionSupported(),
    [settings.pronunciationEnabled],
  )

  useEffect(() => {
    let cancelled = false
    buildSessionPlan({
      allowSpeech,
      wordsPerSession: settings.wordsPerSession,
      warmupTarget: settings.warmupTarget,
      warmupMinutes: settings.warmupMinutes,
    })
      .then((built) => {
        if (cancelled) return
        setPlan(built)
        setPhase('warmup')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'Impossibile preparare la sessione.')
      })
    return () => {
      cancelled = true
    }
  }, [allowSpeech, settings.warmupMinutes, settings.warmupTarget, settings.wordsPerSession])

  const completedStages = useMemo(() => results.map((r) => r.stage), [results])

  const pushResult = useCallback(
    (stage: SessionStageId, correct: number, total: number, durationMs: number, keys: string[]) => {
      setResults((prev) => [...prev, { stage, correct, total, durationMs }])
      setWeakKeys((prev) => [...prev, ...keys])
    },
    [],
  )

  // ------------------------------------------------------------- handlers

  const handleWarmup = useCallback(
    (outcome: AlphabetOutcome) => {
      pushResult(
        'warmup',
        outcome.correct,
        outcome.total,
        outcome.durationMs,
        outcome.wrongLetterIds.map((id) => itemKey('letter', id)),
      )
      setPhase('words')
    },
    [pushResult],
  )

  const handleStage = useCallback(
    (stage: SessionStageId, next: Phase) => (outcome: SequenceOutcome) => {
      pushResult(stage, outcome.correct, outcome.total, outcome.durationMs, outcome.wrongKeys)
      setPhase(next)
    },
    [pushResult],
  )

  const handleTravel = useCallback(
    (outcome: ScenarioOutcome) => {
      pushResult('travel', outcome.correct, outcome.total, outcome.durationMs, outcome.wrongKeys)
      setPhase('review')
    },
    [pushResult],
  )

  // Build the review block from everything that went wrong.
  useEffect(() => {
    if (phase !== 'review') return
    const rng = createRng(seedFromString(`review-${startedAt}`))
    const exercises = buildReviewExercises(weakKeys, itemsByKey, rng, allowSpeech)
    setReviewExercises(exercises)
  }, [allowSpeech, itemsByKey, phase, startedAt, weakKeys])

  const finishSession = useCallback(
    async (reviewOutcome: SequenceOutcome | null) => {
      const stages = reviewOutcome
        ? [
            ...results,
            {
              stage: 'review' as const,
              correct: reviewOutcome.correct,
              total: reviewOutcome.total,
              durationMs: reviewOutcome.durationMs,
            },
          ]
        : results

      const correct = stages.reduce((sum, s) => sum + s.correct, 0)
      const total = stages.reduce((sum, s) => sum + s.total, 0)
      const activeMs = stages.reduce((sum, s) => sum + s.durationMs, 0)
      const allWeak = [
        ...weakKeys,
        ...(reviewOutcome?.wrongKeys ?? []),
      ]

      const record: SessionRecord = {
        startedAt,
        endedAt: Date.now(),
        durationMs: Date.now() - startedAt,
        activeMs,
        correct,
        total,
        newItems: plan?.newItemKeys.length ?? 0,
        stages,
        weakKeys: [...new Set(allWeak)],
        completed: true,
        mode: 'daily',
      }

      await saveSession(record)
      await useAppStore.getState().reload()
      setSession(record)
      setPhase('recap')
    },
    [plan?.newItemKeys.length, results, startedAt, weakKeys],
  )

  // ---------------------------------------------------------------- views

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-danger">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Torna alla home
        </Button>
      </div>
    )
  }

  if (phase === 'loading' || !plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        <p className="text-sm text-ink-faint">Preparo la sessione…</p>
      </div>
    )
  }

  if (phase === 'recap' && session) {
    return <SessionRecap session={session} streakBefore={streakBefore.current} />
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 pt-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Esci dalla sessione"
          className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden className="text-lg">
            ✕
          </span>
        </button>
        <Timer startedAt={startedAt} />
      </div>

      <div className="mt-3 border-b border-border pb-3">
        <SessionProgress current={phase as SessionStageId} completed={completedStages} />
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        {phase === 'warmup' && (
          <AlphabetTrainer
            queue={plan.warmupQueue}
            target={plan.warmupTarget}
            budgetMs={plan.warmupMs}
            title="Warm-up: alfabeto"
            subtitle={`Obiettivo: ${plan.warmupTarget} risposte corrette`}
            onComplete={handleWarmup}
          />
        )}

        {phase === 'words' && (
          <ExerciseSequence
            exercises={plan.words}
            header={<StageHeading stage="words" />}
            onComplete={handleStage('words', 'listening')}
          />
        )}

        {phase === 'listening' && (
          <ExerciseSequence
            exercises={plan.listening}
            header={<StageHeading stage="listening" />}
            onComplete={handleStage('listening', 'sentences')}
          />
        )}

        {phase === 'sentences' && (
          <ExerciseSequence
            exercises={plan.sentences}
            header={<StageHeading stage="sentences" />}
            onComplete={handleStage('sentences', 'travel')}
          />
        )}

        {phase === 'travel' && (
          <ScenarioPlayer scenario={plan.scenario} onComplete={handleTravel} finalLabel="Vai al ripasso" />
        )}

        {phase === 'review' &&
          (reviewExercises.length > 0 ? (
            <ExerciseSequence
              exercises={reviewExercises}
              header={<StageHeading stage="review" />}
              finalLabel="Vedi il riepilogo"
              onComplete={(outcome) => void finishSession(outcome)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <p className="text-4xl" aria-hidden>
                ✨
              </p>
              <p className="text-base font-semibold">Nessun errore da ripassare</p>
              <p className="max-w-xs text-sm text-ink-muted">
                Hai risposto correttamente a tutto: il ripasso finale non serve.
              </p>
              <Button size="lg" onClick={() => void finishSession(null)}>
                Vedi il riepilogo
              </Button>
            </div>
          ))}
      </div>
    </div>
  )
}

function StageHeading({ stage }: { stage: SessionStageId }) {
  return <h1 className="text-lg font-bold">{STAGE_TITLES[stage]}</h1>
}
