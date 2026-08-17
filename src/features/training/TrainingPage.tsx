import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Exercise } from '@/types/exercise'
import { ExerciseSequence, type SequenceOutcome } from './ExerciseSequence'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatMinutes } from '@/utils/time'

interface Props {
  title: string
  subtitle?: string
  /** Called on mount and on "Ancora" — must return a fresh batch. */
  load(): Promise<Exercise[]>
  emptyMessage?: string
}

/**
 * Shared shell for the free-training modes: load a batch, run it, show a
 * compact result, offer another batch.
 */
export function TrainingPage({ title, subtitle, load, emptyMessage }: Props) {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [outcome, setOutcome] = useState<SequenceOutcome | null>(null)
  const [round, setRound] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setExercises(null)
    setOutcome(null)
    load()
      .then((built) => {
        if (!cancelled) setExercises(built)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Errore nel caricamento.')
        }
      })
    return () => {
      cancelled = true
    }
    // `load` is recreated by the page on every render; the round counter is
    // the intentional trigger for a new batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round])

  const again = useCallback(() => setRound((value) => value + 1), [])

  if (error) {
    return (
      <>
        <PageHeader title={title} back="/" />
        <p className="text-sm text-danger">{error}</p>
      </>
    )
  }

  if (!exercises) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} back="/" />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      </>
    )
  }

  if (exercises.length === 0) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} back="/" />
        <div className="card mt-6 p-5 text-center text-sm text-ink-muted">
          {emptyMessage ?? 'Non c\'è nulla da allenare qui al momento.'}
        </div>
        <Link to="/" className="mt-4">
          <Button fullWidth variant="secondary">
            Torna alla home
          </Button>
        </Link>
      </>
    )
  }

  if (outcome) {
    const accuracy = outcome.total === 0 ? 0 : outcome.correct / outcome.total
    return (
      <>
        <PageHeader title={title} back="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <div>
            <p className="text-4xl" aria-hidden>
              {accuracy >= 0.8 ? '🎯' : accuracy >= 0.6 ? '💪' : '📖'}
            </p>
            <p className="mt-3 text-3xl font-black tabular-nums">
              {outcome.correct}/{outcome.total}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {Math.round(accuracy * 100)}% · {formatMinutes(outcome.durationMs)} minuti
            </p>
          </div>
          <ProgressBar
            value={accuracy}
            className="w-full max-w-xs"
            tone={accuracy >= 0.8 ? 'success' : accuracy >= 0.6 ? 'accent' : 'warn'}
          />
          <div className="w-full space-y-2.5">
            <Button fullWidth size="lg" onClick={again}>
              Ancora
            </Button>
            <Link to="/">
              <Button fullWidth variant="secondary">
                Torna alla home
              </Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} back="/" />
      <ExerciseSequence
        key={round}
        exercises={exercises}
        onComplete={setOutcome}
        finalLabel="Vedi il risultato"
      />
    </>
  )
}
