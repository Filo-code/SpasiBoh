import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/store/appStore'
import { getRussianVoices, onVoicesChanged, speak } from '@/services/speech'
import { isRecognitionSupported } from '@/services/recognition'
import {
  backupFileName,
  exportProgress,
  importProgress,
  validateBackup,
  type ImportMode,
} from '@/db/backup'
import { WORDS } from '@/data/words'
import { PHRASES } from '@/data/phrases'
import { SCENARIOS } from '@/data/scenarios'

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const resetProgress = useAppStore((state) => state.resetProgress)
  const items = useAppStore((state) => state.items)

  const [voices, setVoices] = useState(() => getRussianVoices())
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [resetStep, setResetStep] = useState(0)
  const [importMode, setImportMode] = useState<ImportMode>('replace')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => onVoicesChanged(() => setVoices(getRussianVoices())), [])

  const handleExport = async () => {
    try {
      const backup = await exportProgress()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName()
      link.click()
      URL.revokeObjectURL(url)
      setMessage({ tone: 'ok', text: 'Progresso esportato.' })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Esportazione fallita.',
      })
    }
  }

  const handleImport = async (file: File) => {
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      const validation = validateBackup(parsed)
      if (!validation.valid) {
        setMessage({ tone: 'error', text: `File non valido: ${validation.errors[0]}` })
        return
      }
      await importProgress(parsed as Parameters<typeof importProgress>[0], importMode)
      await useAppStore.getState().reload()
      setMessage({
        tone: 'ok',
        text: `Importati ${validation.summary?.items ?? 0} elementi di progresso.`,
      })
    } catch (cause) {
      setMessage({
        tone: 'error',
        text: cause instanceof Error ? cause.message : 'Importazione fallita.',
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleReset = async () => {
    if (resetStep < 2) {
      setResetStep((step) => step + 1)
      return
    }
    await resetProgress()
    setResetStep(0)
    setMessage({ tone: 'ok', text: 'Progresso azzerato.' })
  }

  return (
    <>
      <PageHeader title="Impostazioni" back="/" />

      {message && (
        <div
          role="status"
          className={`mb-5 rounded-xl border p-3 text-sm ${
            message.tone === 'ok'
              ? 'border-success/40 bg-success-soft text-success'
              : 'border-danger/40 bg-danger-soft text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ------------------------------------------------------------- audio */}
      <Fieldset title="Audio">
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-muted">Voce russa</span>
          <select
            value={settings.voiceURI ?? ''}
            onChange={(event) => void updateSettings({ voiceURI: event.target.value || null })}
            className="tap-target w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm"
          >
            <option value="">Automatica</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
          {voices.length === 0 && (
            <span className="mt-1.5 block text-xs text-warn">
              Nessuna voce russa trovata su questo dispositivo.
            </span>
          )}
        </label>

        <Slider
          label="Velocità normale"
          value={settings.speechRate}
          min={0.6}
          max={1.3}
          step={0.05}
          onChange={(value) => void updateSettings({ speechRate: value })}
        />
        <Slider
          label="Velocità lenta"
          value={settings.slowSpeechRate}
          min={0.3}
          max={0.9}
          step={0.05}
          onChange={(value) => void updateSettings({ slowSpeechRate: value })}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            speak('Здравствуйте! Я говорю по-русски.', {
              rate: settings.speechRate,
              voiceURI: settings.voiceURI,
            })
          }
        >
          🔊 Prova la voce
        </Button>

        <Toggle
          label="Riproduci automaticamente negli esercizi di ascolto"
          checked={settings.autoPlayAudio}
          onChange={(checked) => void updateSettings({ autoPlayAudio: checked })}
        />
      </Fieldset>

      {/* --------------------------------------------------------- pronuncia */}
      <Fieldset title="Pronuncia">
        <Toggle
          label="Includi esercizi al microfono"
          checked={settings.pronunciationEnabled}
          onChange={(checked) => void updateSettings({ pronunciationEnabled: checked })}
        />
        <p className="text-xs text-ink-faint">
          {isRecognitionSupported()
            ? 'Il riconoscimento vocale del browser è disponibile. Verifica solo se la parola viene riconosciuta: non è un\'analisi fonetica dell\'accento.'
            : 'Questo browser non supporta il riconoscimento vocale: gli esercizi restano disponibili in auto-valutazione e non incidono sulle statistiche.'}
        </p>
      </Fieldset>

      {/* ---------------------------------------------------------- sessione */}
      <Fieldset title="Sessione quotidiana">
        <Slider
          label={`Obiettivo warm-up: ${settings.warmupTarget} risposte corrette`}
          value={settings.warmupTarget}
          min={5}
          max={40}
          step={1}
          onChange={(value) => void updateSettings({ warmupTarget: value })}
          format={(value) => String(value)}
        />
        <Slider
          label={`Tempo indicativo warm-up: ${settings.warmupMinutes} minuti`}
          value={settings.warmupMinutes}
          min={3}
          max={20}
          step={1}
          onChange={(value) => void updateSettings({ warmupMinutes: value })}
          format={(value) => `${value} min`}
        />
        <Slider
          label={`Parole per sessione: ${settings.wordsPerSession}`}
          value={settings.wordsPerSession}
          min={6}
          max={30}
          step={1}
          onChange={(value) => void updateSettings({ wordsPerSession: value })}
          format={(value) => String(value)}
        />
      </Fieldset>

      {/* ------------------------------------------------------------ backup */}
      <Fieldset title="Backup">
        <p className="text-xs text-ink-faint">
          {items.length} elementi di progresso salvati localmente in IndexedDB.
        </p>
        <Button variant="secondary" onClick={() => void handleExport()} fullWidth>
          ⬇️ Esporta progresso
        </Button>

        <div className="rounded-xl border border-border bg-bg-soft p-3">
          <span className="mb-2 block text-sm text-ink-muted">Importa progresso</span>
          <div className="mb-2.5 flex gap-2">
            {(['replace', 'merge'] as ImportMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setImportMode(mode)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  importMode === mode
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface-2 text-ink-muted'
                }`}
              >
                {mode === 'replace' ? 'Sostituisci' : 'Unisci'}
              </button>
            ))}
          </div>
          <p className="mb-2.5 text-[0.7rem] text-ink-faint">
            {importMode === 'replace'
              ? 'Cancella il progresso locale e usa quello del file.'
              : 'Tiene il valore migliore fra locale e file per ogni elemento.'}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
            }}
            className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-xs file:text-ink"
          />
        </div>
      </Fieldset>

      {/* ------------------------------------------------------------- reset */}
      <Fieldset title="Zona pericolosa">
        <Button variant="danger" fullWidth onClick={() => void handleReset()}>
          {resetStep === 0
            ? 'Resetta progresso'
            : resetStep === 1
              ? 'Sei sicuro? Tocca ancora'
              : 'Conferma definitiva: cancella tutto'}
        </Button>
        {resetStep > 0 && (
          <Button variant="ghost" fullWidth onClick={() => setResetStep(0)}>
            Annulla
          </Button>
        )}
        <p className="text-xs text-ink-faint">
          Cancella permanentemente cronologia, statistiche e ripetizione dilazionata. Le
          preferenze audio restano. Esporta prima un backup se vuoi poterlo recuperare.
        </p>
      </Fieldset>

      <Fieldset title="Contenuti inclusi">
        <ul className="space-y-1 text-xs text-ink-faint">
          <li>33 lettere dell&apos;alfabeto cirillico</li>
          <li>{WORDS.length} parole con traslitterazione e accento</li>
          <li>{PHRASES.length} frasi da viaggio</li>
          <li>{SCENARIOS.length} situazioni reali interattive</li>
          <li>Tutto disponibile offline, nessun account, nessun server.</li>
        </ul>
      </Fieldset>
    </>
  )
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
        {title}
      </h2>
      <div className="card space-y-3.5 p-4">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange(value: boolean): void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-6 shrink-0 accent-[var(--color-accent)]"
      />
    </label>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange(value: number): void
  format?(value: number): string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm text-ink-muted">
        <span>{label}</span>
        {format ? null : <span className="tabular-nums text-ink">{value.toFixed(2)}×</span>}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
    </label>
  )
}
