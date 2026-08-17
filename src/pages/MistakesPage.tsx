import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { TrainingPage } from '@/features/training/TrainingPage'
import { Button } from '@/components/ui/Button'
import { RussianText } from '@/components/ui/RussianText'
import { MasteryBadge } from '@/components/ui/MasteryBadge'
import { AudioButton } from '@/components/exercise/AudioButton'
import { useAppStore } from '@/store/appStore'
import { buildMistakesTraining, collectWeakItems } from '@/engine/session'
import { accuracyOf } from '@/engine/mastery'
import { formatAgo } from '@/utils/time'
import { isRecognitionSupported } from '@/services/recognition'
import { ALPHABET_BY_ID } from '@/data/alphabet'

/** "I miei errori": what you keep getting wrong, and a drill focused on it. */
export function MistakesPage() {
  const items = useAppStore((state) => state.items)
  const pronunciationEnabled = useAppStore((state) => state.settings.pronunciationEnabled)
  const [training, setTraining] = useState(false)

  const weak = useMemo(() => collectWeakItems(items), [items])
  const weakLetters = weak.filter((entry) => entry.kind === 'letter')
  const weakRest = weak.filter((entry) => entry.kind !== 'letter')

  const load = useCallback(async () => {
    const result = await buildMistakesTraining({
      count: 14,
      allowSpeech: pronunciationEnabled && isRecognitionSupported(),
      seed: Date.now(),
    })
    return result.exercises
  }, [pronunciationEnabled])

  if (training) {
    return (
      <TrainingPage
        title="Allenamento errori"
        subtitle="Solo i tuoi punti deboli"
        load={load}
        emptyMessage="Nessun errore da allenare: hai tutto sotto controllo."
      />
    )
  }

  return (
    <>
      <PageHeader title="I miei errori" subtitle={`${weak.length} elementi da rinforzare`} back="/" />

      {weak.length === 0 ? (
        <div className="card mt-4 p-6 text-center">
          <p className="text-3xl" aria-hidden>
            ✨
          </p>
          <p className="mt-3 font-semibold">Nessun punto debole registrato</p>
          <p className="mt-1 text-sm text-ink-muted">
            Fai qualche sessione: qui compariranno le lettere, le parole e le frasi che sbagli più
            spesso.
          </p>
          <Link to="/sessione" className="mt-5 block">
            <Button fullWidth>Inizia una sessione</Button>
          </Link>
        </div>
      ) : (
        <>
          <Button fullWidth size="lg" onClick={() => setTraining(true)}>
            Allenati sugli errori
          </Button>

          {weakLetters.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Lettere
              </h2>
              <ul className="grid grid-cols-2 gap-2.5">
                {weakLetters.map((entry) => {
                  const accuracy = accuracyOf(entry.progress)
                  const letter = ALPHABET_BY_ID[entry.id]
                  return (
                    <li key={entry.key} className="card flex items-center gap-3 p-3">
                      <RussianText size="lg" className="w-10 shrink-0 text-center">
                        {entry.label}
                      </RussianText>
                      <div className="min-w-0">
                        <div className="text-sm font-bold tabular-nums text-danger">
                          {accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`}
                        </div>
                        <div className="truncate text-[0.7rem] text-ink-faint">
                          {entry.progress.wrongCount} errori
                        </div>
                        {letter && (
                          <div className="truncate text-[0.7rem] text-ink-faint">
                            {letter.soundKey}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {weakRest.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Parole e frasi
              </h2>
              <ul className="space-y-2">
                {weakRest.map((entry) => {
                  const accuracy = accuracyOf(entry.progress)
                  return (
                    <li key={entry.key} className="card p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <RussianText size="sm" className="block break-words">
                            {entry.label}
                          </RussianText>
                          <p className="mt-0.5 text-sm text-ink-muted">{entry.sublabel}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-bold tabular-nums text-danger">
                            {accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`}
                          </div>
                          <MasteryBadge
                            mastery={entry.progress.mastery}
                            seenCount={entry.progress.seenCount}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-end justify-between gap-3">
                        <p className="text-[0.7rem] text-ink-faint">
                          {entry.progress.wrongCount} error
                          {entry.progress.wrongCount === 1 ? 'e' : 'i'} ·{' '}
                          {entry.progress.seenCount} viste · ultimo ripasso{' '}
                          {formatAgo(entry.progress.lastSeenAt)}
                        </p>
                        <AudioButton text={entry.label} size="sm" showSlow={false} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
