import { useCallback } from 'react'
import { TrainingPage } from '@/features/training/TrainingPage'
import { buildPhraseTraining, buildWordTraining } from '@/engine/session'
import type { Exercise } from '@/types/exercise'
import { createRng, seedFromString } from '@/utils/random'

/**
 * Listening-only drill: half words, half phrases, always audio-first.
 * Nothing is written on screen before the answer.
 */
export function ListeningTrainingPage() {
  const load = useCallback(async (): Promise<Exercise[]> => {
    const seed = Date.now()
    const [words, phrases] = await Promise.all([
      buildWordTraining({ count: 6, allowSpeech: false, forceType: 'audio-it', seed }),
      buildPhraseTraining({
        count: 6,
        allowSpeech: false,
        forceType: 'phrase-listen',
        seed: seed + 1,
      }),
    ])
    const rng = createRng(seedFromString(`listening-${seed}`))
    return rng.shuffle([...words, ...phrases])
  }, [])

  return (
    <TrainingPage
      title="Ascolto"
      subtitle="Solo audio: riconosci parole e frasi"
      load={load}
      emptyMessage="Nessun contenuto disponibile per l'ascolto."
    />
  )
}
