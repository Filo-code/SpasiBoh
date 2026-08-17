import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { ScenarioPlayer } from '@/features/travel/ScenarioPlayer'
import { SCENARIOS, getScenario } from '@/data/scenarios'
import { PHRASES } from '@/data/phrases'
import { useAppStore } from '@/store/appStore'
import { itemKey } from '@/types/progress'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useState } from 'react'

/** Scenario catalogue — "Situazioni reali". */
export function ConversationsPage() {
  const items = useAppStore((state) => state.itemsByKey)

  const scenarios = useMemo(
    () =>
      SCENARIOS.map((scenario) => {
        const related = PHRASES.filter((p) => p.category === scenario.category)
        const mastery =
          related.length === 0
            ? 0
            : related.reduce(
                (sum, phrase) => sum + (items.get(itemKey('phrase', phrase.id))?.mastery ?? 0),
                0,
              ) / related.length
        return { scenario, mastery }
      }),
    [items],
  )

  return (
    <>
      <PageHeader
        title="Situazioni reali"
        subtitle={`${SCENARIOS.length} conversazioni interattive`}
        back="/"
      />
      <ul className="space-y-2.5">
        {scenarios.map(({ scenario, mastery }) => (
          <li key={scenario.id}>
            <Link
              to={`/scenari/${scenario.id}`}
              className="card block p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <div className="flex items-start gap-3.5">
                <span aria-hidden className="text-2xl leading-none">
                  {scenario.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">{scenario.title}</h2>
                    <span className="shrink-0 text-[0.7rem] text-ink-faint">
                      {scenario.steps.length} passaggi
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{scenario.intro}</p>
                  <ProgressBar value={mastery} className="mt-3" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** A single scenario run. */
export function ScenarioPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const scenario = id ? getScenario(id) : undefined
  const [done, setDone] = useState<{ correct: number; total: number } | null>(null)

  if (!scenario) {
    return (
      <>
        <PageHeader title="Scenario" back="/conversazioni" />
        <p className="text-sm text-ink-muted">Questo scenario non esiste.</p>
      </>
    )
  }

  if (done) {
    const accuracy = done.total === 0 ? 0 : done.correct / done.total
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div>
          <p className="text-4xl" aria-hidden>
            {scenario.icon}
          </p>
          <h1 className="mt-3 text-xl font-bold">{scenario.title}</h1>
          <p className="mt-2 text-3xl font-black tabular-nums">
            {done.correct}/{done.total}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{Math.round(accuracy * 100)}% corretto</p>
        </div>
        <div className="w-full space-y-2.5">
          <Button fullWidth size="lg" onClick={() => setDone(null)}>
            Rifai lo scenario
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate('/conversazioni')}>
            Altre situazioni
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col pt-3">
      <button
        type="button"
        onClick={() => navigate('/conversazioni')}
        aria-label="Esci dallo scenario"
        className="-ml-2 mb-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <span aria-hidden className="text-lg">
          ✕
        </span>
      </button>
      <ScenarioPlayer
        key={scenario.id + String(done)}
        scenario={scenario}
        finalLabel="Vedi il risultato"
        onComplete={(outcome) => setDone({ correct: outcome.correct, total: outcome.total })}
      />
    </div>
  )
}
