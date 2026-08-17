import { useCallback } from 'react'
import { TrainingPage } from '@/features/training/TrainingPage'
import { buildPhraseTraining, buildWordTraining } from '@/engine/session'
import type { Exercise } from '@/types/exercise'
import { createRng, seedFromString } from '@/utils/random'
import { isRecognitionSupported } from '@/services/recognition'

/**
 * Microphone drill.
 *
 * Works even where `SpeechRecognition` is missing: the runner falls back to a
 * self-assessment that is explicitly *not* counted in the statistics, so the
 * exercise still functions without faking a score.
 */
export function PronunciationTrainingPage() {
  const load = useCallback(async (): Promise<Exercise[]> => {
    const seed = Date.now()
    const [words, phrases] = await Promise.all([
      buildWordTraining({ count: 7, allowSpeech: true, forceType: 'word-pronounce', seed }),
      buildPhraseTraining({
        count: 5,
        allowSpeech: true,
        forceType: 'phrase-pronounce',
        seed: seed + 1,
      }),
    ])
    const rng = createRng(seedFromString(`pronuncia-${seed}`))
    return rng.shuffle([...words, ...phrases])
  }, [])

  return (
    <>
      {!isRecognitionSupported() && (
        <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          Questo browser non supporta il riconoscimento vocale. Gli esercizi funzionano comunque in
          auto-valutazione, ma non incidono sulle statistiche. Su iPhone usa Safari, su desktop
          Chrome o Edge.
        </div>
      )}
      <TrainingPage
        title="Pronuncia"
        subtitle="Leggi ad alta voce e verifica"
        load={load}
        emptyMessage="Nessun contenuto disponibile per la pronuncia."
      />
    </>
  )
}
