import { useCallback, useState } from 'react'
import { TrainingPage } from '@/features/training/TrainingPage'
import { buildPhraseTraining } from '@/engine/session'
import { PageHeader } from '@/components/layout/AppLayout'
import type { ExerciseType } from '@/types/exercise'
import type { Exercise } from '@/types/exercise'
import { createRng, seedFromString } from '@/utils/random'

interface Mode {
  id: string
  icon: string
  title: string
  description: string
  type?: ExerciseType
}

const MODES: Mode[] = [
  {
    id: 'mix',
    icon: '🧩',
    title: 'Sentence Lab',
    description: 'Tutti i giochi mescolati: costruzione, buchi, ascolto e risposte',
  },
  {
    id: 'build',
    icon: '🔡',
    title: 'Costruisci la frase',
    description: 'Componi la frase russa toccando i blocchi',
    type: 'phrase-build',
  },
  {
    id: 'gap',
    icon: '␣',
    title: 'Completa il buco',
    description: 'Scegli la parola mancante',
    type: 'phrase-gap',
  },
  {
    id: 'listen',
    icon: '🎧',
    title: 'Comprensione orale',
    description: 'Ascolta la frase e scegli il significato',
    type: 'phrase-listen',
  },
  {
    id: 'reply',
    icon: '💬',
    title: 'Rispondi',
    description: 'Scegli la risposta naturale alla domanda',
    type: 'phrase-reply',
  },
]

/** Sentence Lab: four sentence games, plus a mixed mode. */
export function SentencesTrainingPage() {
  const [mode, setMode] = useState<Mode | null>(null)

  const load = useCallback(async (): Promise<Exercise[]> => {
    const seed = Date.now()
    if (!mode || mode.id === 'mix') {
      const batches = await Promise.all(
        (['phrase-build', 'phrase-gap', 'phrase-listen', 'phrase-it-ru'] as ExerciseType[]).map(
          (type, index) =>
            buildPhraseTraining({
              count: 3,
              allowSpeech: false,
              forceType: type,
              seed: seed + index,
            }),
        ),
      )
      const rng = createRng(seedFromString(`sentences-${seed}`))
      return rng.shuffle(batches.flat())
    }
    return buildPhraseTraining({ count: 12, allowSpeech: false, forceType: mode.type, seed })
  }, [mode])

  if (mode) {
    return <TrainingPage title={mode.title} subtitle={mode.description} load={load} />
  }

  return (
    <>
      <PageHeader title="Costruisci frase" subtitle="Sentence Lab" back="/" />
      <ul className="space-y-2.5">
        {MODES.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setMode(entry)}
              className="card flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <span aria-hidden className="text-2xl">
                {entry.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{entry.title}</span>
                <span className="block text-xs text-ink-faint">{entry.description}</span>
              </span>
              <span aria-hidden className="text-accent">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
