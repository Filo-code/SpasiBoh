import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { RussianText } from '@/components/ui/RussianText'
import { AudioButton } from '@/components/exercise/AudioButton'
import { MasteryBadge } from '@/components/ui/MasteryBadge'
import { TrainingPage } from '@/features/training/TrainingPage'
import {
  ACTIVE_PHRASE_CATEGORIES,
  phrasesByCategory,
} from '@/data/phrases'
import {
  PHRASE_CATEGORY_ICONS,
  PHRASE_CATEGORY_LABELS,
  type PhraseCategory,
} from '@/types/content'
import { useAppStore } from '@/store/appStore'
import { itemKey } from '@/types/progress'
import { buildPhraseTraining } from '@/engine/session'
import { isRecognitionSupported } from '@/services/recognition'

/** Travel phrasebook: browse packs, then train one. */
export function TravelPage() {
  const items = useAppStore((state) => state.itemsByKey)

  const packs = useMemo(
    () =>
      ACTIVE_PHRASE_CATEGORIES.map((category) => {
        const phrases = phrasesByCategory(category)
        let mastery = 0
        let seen = 0
        for (const phrase of phrases) {
          const progress = items.get(itemKey('phrase', phrase.id))
          if (progress) {
            mastery += progress.mastery
            seen += 1
          }
        }
        return {
          category,
          count: phrases.length,
          seen,
          mastery: seen === 0 ? 0 : mastery / seen,
        }
      }),
    [items],
  )

  return (
    <>
      <PageHeader title="Russo da viaggio" subtitle="Frasi pronte all'uso" back="/" />
      <ul className="grid grid-cols-2 gap-2.5">
        {packs.map((pack) => (
          <li key={pack.category}>
            <Link
              to={`/viaggio/${pack.category}`}
              className="card flex h-full flex-col justify-between gap-3 p-3.5 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span aria-hidden className="text-2xl leading-none">
                {PHRASE_CATEGORY_ICONS[pack.category]}
              </span>
              <span>
                <span className="block font-semibold leading-tight">
                  {PHRASE_CATEGORY_LABELS[pack.category]}
                </span>
                <span className="block text-xs text-ink-faint">
                  {pack.seen}/{pack.count} frasi
                </span>
              </span>
              <MasteryBadge mastery={pack.mastery} seenCount={pack.seen} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

/** One pack: the phrase list plus a drill button. */
export function TravelPackPage() {
  const { category } = useParams<{ category: string }>()
  const items = useAppStore((state) => state.itemsByKey)
  const pronunciationEnabled = useAppStore((state) => state.settings.pronunciationEnabled)
  const [training, setTraining] = useState(false)

  const validCategory = ACTIVE_PHRASE_CATEGORIES.includes(category as PhraseCategory)
    ? (category as PhraseCategory)
    : null

  const phrases = validCategory ? phrasesByCategory(validCategory) : []

  const load = useCallback(
    () =>
      buildPhraseTraining({
        count: Math.min(12, phrases.length),
        allowSpeech: pronunciationEnabled && isRecognitionSupported(),
        category: validCategory ?? undefined,
        seed: Date.now(),
      }),
    [phrases.length, pronunciationEnabled, validCategory],
  )

  if (!validCategory) {
    return (
      <>
        <PageHeader title="Pacchetto" back="/viaggio" />
        <p className="text-sm text-ink-muted">Questo pacchetto non esiste.</p>
      </>
    )
  }

  if (training) {
    return (
      <TrainingPage
        title={PHRASE_CATEGORY_LABELS[validCategory]}
        subtitle="Allenamento del pacchetto"
        load={load}
      />
    )
  }

  return (
    <>
      <PageHeader
        title={`${PHRASE_CATEGORY_ICONS[validCategory]} ${PHRASE_CATEGORY_LABELS[validCategory]}`}
        subtitle={`${phrases.length} frasi`}
        back="/viaggio"
      />

      <Button fullWidth size="lg" onClick={() => setTraining(true)}>
        Allena questo pacchetto
      </Button>

      <ul className="mt-6 space-y-2.5">
        {phrases.map((phrase) => {
          const progress = items.get(itemKey('phrase', phrase.id))
          return (
            <li key={phrase.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <RussianText size="sm" className="block break-words">
                  {phrase.russian}
                </RussianText>
                <MasteryBadge
                  mastery={progress?.mastery ?? 0}
                  seenCount={progress?.seenCount ?? 0}
                  className="shrink-0"
                />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{phrase.italian}</p>
              <p className="mt-0.5 text-xs text-ink-faint">🗣 {phrase.transliteration}</p>
              {phrase.notes && <p className="mt-1.5 text-xs text-warn/90">ℹ️ {phrase.notes}</p>}
              <AudioButton text={phrase.audioText} size="sm" className="mt-2.5" />
            </li>
          )
        })}
      </ul>
    </>
  )
}
