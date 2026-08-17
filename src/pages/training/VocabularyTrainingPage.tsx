import { useCallback, useMemo, useState } from 'react'
import { TrainingPage } from '@/features/training/TrainingPage'
import { buildWordTraining } from '@/engine/session'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { ACTIVE_WORD_CATEGORIES, wordsByCategory } from '@/data/words'
import { CATEGORY_LABELS } from '@/types/content'
import type { WordCategory } from '@/types/content'
import { useAppStore } from '@/store/appStore'
import { isRecognitionSupported } from '@/services/recognition'
import { MasteryBadge } from '@/components/ui/MasteryBadge'
import { itemKey } from '@/types/progress'

const BATCH = 14

/** Vocabulary free training: pick a category (or everything) and drill. */
export function VocabularyTrainingPage() {
  const [category, setCategory] = useState<WordCategory | null>(null)
  const [started, setStarted] = useState(false)
  const items = useAppStore((state) => state.itemsByKey)
  const pronunciationEnabled = useAppStore((state) => state.settings.pronunciationEnabled)

  const load = useCallback(
    () =>
      buildWordTraining({
        count: BATCH,
        allowSpeech: pronunciationEnabled && isRecognitionSupported(),
        category: category ?? undefined,
        seed: Date.now(),
      }),
    [category, pronunciationEnabled],
  )

  const categoryStats = useMemo(() => {
    return ACTIVE_WORD_CATEGORIES.map((cat) => {
      const words = wordsByCategory(cat)
      let mastery = 0
      let seen = 0
      for (const word of words) {
        const progress = items.get(itemKey('word', word.id))
        if (progress) {
          mastery += progress.mastery
          seen += 1
        }
      }
      return {
        category: cat,
        total: words.length,
        seen,
        mastery: seen === 0 ? 0 : mastery / seen,
      }
    })
  }, [items])

  if (started) {
    return (
      <TrainingPage
        title="Vocabolario"
        subtitle={category ? CATEGORY_LABELS[category] : 'Tutte le categorie'}
        load={load}
      />
    )
  }

  return (
    <>
      <PageHeader title="Vocabolario" subtitle="Scegli cosa allenare" back="/" />

      <button
        type="button"
        onClick={() => {
          setCategory(null)
          setStarted(true)
        }}
        className="card flex w-full items-center justify-between p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <span>
          <span className="block font-semibold">Allenamento intelligente</span>
          <span className="block text-xs text-ink-faint">
            Il motore sceglie: ripassi, punti deboli e parole nuove
          </span>
        </span>
        <span aria-hidden className="text-lg text-accent">
          →
        </span>
      </button>

      <h2 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        Per categoria
      </h2>
      <ul className="space-y-2">
        {categoryStats.map((entry) => (
          <li key={entry.category}>
            <button
              type="button"
              onClick={() => {
                setCategory(entry.category)
                setStarted(true)
              }}
              className="card flex w-full items-center justify-between gap-3 p-3.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {CATEGORY_LABELS[entry.category]}
                </span>
                <span className="block text-xs text-ink-faint">
                  {entry.seen}/{entry.total} parole viste
                </span>
              </span>
              <MasteryBadge mastery={entry.mastery} seenCount={entry.seen} />
            </button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" className="mt-6" onClick={() => setStarted(true)} fullWidth>
        Inizia con tutte le categorie
      </Button>
    </>
  )
}
