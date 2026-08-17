import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { AlphabetTrainer, type AlphabetOutcome } from '@/features/alphabet/AlphabetTrainer'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RussianText } from '@/components/ui/RussianText'
import { AudioButton } from '@/components/exercise/AudioButton'
import { MasteryBadge } from '@/components/ui/MasteryBadge'
import { ALPHABET, ALPHABET_BY_ID } from '@/data/alphabet'
import { buildAlphabetTraining } from '@/engine/session'
import { useAppStore } from '@/store/appStore'
import { itemKey } from '@/types/progress'

const TARGET = 15

export function AlphabetTrainingPage() {
  const [view, setView] = useState<'menu' | 'drill' | 'done'>('menu')
  const [queue, setQueue] = useState<string[]>([])
  const [outcome, setOutcome] = useState<AlphabetOutcome | null>(null)
  const items = useAppStore((state) => state.itemsByKey)

  useEffect(() => {
    if (view !== 'drill') return
    let cancelled = false
    buildAlphabetTraining({ count: 40, allowSpeech: true, seed: Date.now() }).then((built) => {
      if (!cancelled) setQueue(built)
    })
    return () => {
      cancelled = true
    }
  }, [view])

  const letters = useMemo(
    () =>
      ALPHABET.map((letter) => ({
        letter,
        progress: items.get(itemKey('letter', letter.id)),
      })),
    [items],
  )

  const mastered = letters.filter(({ progress }) => (progress?.mastery ?? 0) >= 0.85).length

  if (view === 'drill') {
    if (queue.length === 0) {
      return (
        <>
          <PageHeader title="Alfabeto" back="/" />
          <div className="flex flex-1 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        </>
      )
    }
    return (
      <AlphabetTrainer
        queue={queue}
        target={TARGET}
        title="Alfabeto"
        subtitle={`Obiettivo: ${TARGET} risposte corrette`}
        allowSkip
        onComplete={(result) => {
          setOutcome(result)
          setView('done')
        }}
      />
    )
  }

  if (view === 'done' && outcome) {
    const accuracy = outcome.total === 0 ? 0 : outcome.correct / outcome.total
    return (
      <>
        <PageHeader title="Alfabeto" back="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-3xl font-black tabular-nums">
            {outcome.correct}/{outcome.total}
          </p>
          <ProgressBar value={accuracy} className="w-full max-w-xs" showValue label="Precisione" />
          {outcome.wrongLetterIds.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-ink-faint">Da ripassare</p>
              <div className="flex flex-wrap justify-center gap-2">
                {outcome.wrongLetterIds.map((id) => (
                  <span
                    key={id}
                    className="cyr rounded-lg border border-danger/40 bg-danger-soft px-3 py-1.5 text-xl font-bold text-danger"
                  >
                    {ALPHABET_BY_ID[id]?.upper ?? id}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="w-full space-y-2.5">
            <Button fullWidth size="lg" onClick={() => setView('drill')}>
              Ancora
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setView('menu')}>
              Vedi tutte le lettere
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Alfabeto" subtitle={`${mastered}/33 lettere padroneggiate`} back="/" />

      <Button fullWidth size="lg" onClick={() => setView('drill')}>
        Inizia l&apos;allenamento
      </Button>

      <h2 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Tutte le lettere
      </h2>
      <ul className="space-y-2">
        {letters.map(({ letter, progress }) => (
          <li key={letter.id} className="card p-3.5">
            <div className="flex items-start gap-3.5">
              <RussianText size="lg" className="w-14 shrink-0 text-center">
                {`${letter.upper} ${letter.lower}`}
              </RussianText>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="cyr text-sm text-ink-muted">{letter.name}</span>
                  <MasteryBadge
                    mastery={progress?.mastery ?? 0}
                    seenCount={progress?.seenCount ?? 0}
                  />
                </div>
                <p className="mt-1 text-sm">{letter.pronunciation}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  <span className="cyr">{letter.exampleWord}</span> — {letter.exampleWordItalian} (
                  {letter.exampleWordTranslit})
                </p>
                {letter.notes && (
                  <p className="mt-1.5 text-xs text-warn/90">ℹ️ {letter.notes}</p>
                )}
                <AudioButton text={letter.exampleWord} size="sm" className="mt-2.5" />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link to="/" className="mt-6 block">
        <Button fullWidth variant="ghost">
          Torna alla home
        </Button>
      </Link>
    </>
  )
}
