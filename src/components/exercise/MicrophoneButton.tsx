import type { MicState } from '@/hooks/useMicrophone'

interface Props {
  state: MicState
  disabled?: boolean
  onStart(): void
  onStop(): void
}

const LABELS: Record<MicState, string> = {
  idle: 'Tocca e parla',
  listening: 'Sto ascoltando… tocca per fermare',
  processing: 'Elaboro…',
  done: 'Riprova',
}

export function MicrophoneButton({ state, disabled, onStart, onStop }: Props) {
  const listening = state === 'listening'
  const busy = state === 'processing'

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={listening ? onStop : onStart}
        aria-label={listening ? 'Ferma la registrazione' : 'Avvia la registrazione vocale'}
        aria-pressed={listening}
        className={[
          'flex h-20 w-20 items-center justify-center rounded-full border-2 text-3xl transition-colors',
          'disabled:cursor-not-allowed disabled:opacity-60',
          listening
            ? 'animate-listening border-danger bg-danger/20 text-danger'
            : 'border-border-strong bg-surface-2 text-ink hover:border-accent hover:text-accent',
        ].join(' ')}
      >
        <span aria-hidden>{listening ? '⏹' : '🎙'}</span>
      </button>
      <span className="text-xs text-ink-muted" aria-live="polite">
        {LABELS[state]}
      </span>
    </div>
  )
}
