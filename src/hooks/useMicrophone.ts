import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isRecognitionSupported,
  RECOGNITION_ERROR_MESSAGES,
  startRecognition,
  type RecognitionErrorKind,
  type RecognitionSession,
} from '@/services/recognition'
import { matchSpeech, type SpeechMatch } from '@/utils/text'

export type MicState = 'idle' | 'listening' | 'processing' | 'done'

export interface MicResult extends SpeechMatch {
  /** Raw alternatives, kept so the UI can show "Hai detto: …". */
  transcripts: string[]
  error: RecognitionErrorKind | null
  errorMessage: string | null
}

/**
 * One-shot microphone attempt against an expected Russian phrase.
 *
 * The hook never decides on its own that the user was "wrong" because the
 * browser failed — a `not-allowed` or `unsupported` outcome is surfaced as an
 * error so the exercise can fall back to self-assessment instead of punishing
 * the user for a missing API.
 */
export function useMicrophone() {
  const [state, setState] = useState<MicState>('idle')
  const [result, setResult] = useState<MicResult | null>(null)
  const sessionRef = useRef<RecognitionSession | null>(null)
  const supported = isRecognitionSupported()

  useEffect(
    () => () => {
      sessionRef.current?.abort()
      sessionRef.current = null
    },
    [],
  )

  const reset = useCallback(() => {
    sessionRef.current?.abort()
    sessionRef.current = null
    setState('idle')
    setResult(null)
  }, [])

  const listen = useCallback(
    (expected: string, accepted: string[] = []) => {
      if (state === 'listening') return
      setResult(null)
      setState('listening')

      sessionRef.current = startRecognition({
        lang: 'ru-RU',
        onStart: () => setState('listening'),
        onResult: ({ transcripts, error }) => {
          const match = matchSpeech(transcripts, expected, accepted)
          setResult({
            ...match,
            transcripts,
            error,
            errorMessage: error ? RECOGNITION_ERROR_MESSAGES[error] : null,
          })
          setState('done')
          sessionRef.current = null
        },
      })
    },
    [state],
  )

  const stop = useCallback(() => {
    if (state !== 'listening') return
    setState('processing')
    sessionRef.current?.stop()
  }, [state])

  return { state, result, listen, stop, reset, supported }
}
