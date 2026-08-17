/**
 * Speech recognition wrapper.
 *
 * Important: this is **not** pronunciation scoring. All it can honestly tell
 * you is whether the browser's Russian recogniser produced the word we were
 * expecting. A perfect Italian accent that the recogniser still understands
 * passes; a mumbled but recognised word also passes. The UI says so.
 *
 * Availability, as of writing: Chrome/Edge desktop and Android yes, Safari on
 * iOS yes (needs a user gesture and sends audio to Apple), Firefox no.
 */

export type RecognitionErrorKind =
  | 'unsupported'
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown'

export interface RecognitionOutcome {
  transcripts: string[]
  error: RecognitionErrorKind | null
}

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isRecognitionSupported(): boolean {
  return getConstructor() !== null
}

export interface RecognitionSession {
  stop(): void
  abort(): void
}

export interface StartOptions {
  lang?: string
  maxAlternatives?: number
  /** Hard stop after this many ms in case `onend` never fires. */
  timeoutMs?: number
  onResult(outcome: RecognitionOutcome): void
  onStart?(): void
  onEnd?(): void
}

/**
 * Starts a one-shot recognition. Resolves through `onResult` exactly once.
 */
export function startRecognition(options: StartOptions): RecognitionSession | null {
  const Ctor = getConstructor()
  if (!Ctor) {
    options.onResult({ transcripts: [], error: 'unsupported' })
    options.onEnd?.()
    return null
  }

  const recognition = new Ctor()
  recognition.lang = options.lang ?? 'ru-RU'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = options.maxAlternatives ?? 5

  let settled = false
  const transcripts: string[] = []
  let error: RecognitionErrorKind | null = null

  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    options.onResult({ transcripts, error: transcripts.length > 0 ? null : (error ?? 'no-speech') })
    options.onEnd?.()
  }

  const timer = setTimeout(() => {
    try {
      recognition.abort()
    } catch {
      /* already stopped */
    }
    finish()
  }, options.timeoutMs ?? 8000)

  recognition.onstart = () => options.onStart?.()

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      for (let j = 0; j < result.length; j++) {
        const alternative = result[j]
        if (alternative?.transcript) transcripts.push(alternative.transcript)
      }
    }
  }

  recognition.onerror = (event) => {
    error = mapError(event.error)
  }

  recognition.onend = () => finish()

  try {
    recognition.start()
  } catch {
    error = 'unknown'
    finish()
    return null
  }

  return {
    stop: () => {
      try {
        recognition.stop()
      } catch {
        finish()
      }
    },
    abort: () => {
      try {
        recognition.abort()
      } catch {
        /* ignore */
      }
      finish()
    },
  }
}

function mapError(raw: string): RecognitionErrorKind {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'not-allowed'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'audio-capture'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'unknown'
  }
}

export const RECOGNITION_ERROR_MESSAGES: Record<RecognitionErrorKind, string> = {
  unsupported: 'Il riconoscimento vocale non è disponibile in questo browser.',
  'not-allowed': 'Accesso al microfono negato. Controlla i permessi del browser.',
  'no-speech': 'Non ho sentito nulla. Riprova avvicinandoti al microfono.',
  'audio-capture': 'Nessun microfono disponibile.',
  network: 'Il riconoscimento vocale richiede la rete e non è raggiungibile.',
  aborted: 'Registrazione interrotta.',
  unknown: 'Il riconoscimento vocale non è riuscito.',
}
