import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useToday } from '@/hooks/useDayStats'
import { StatCard } from '@/components/ui/StatCard'
import { Section, Tile } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { overallStats } from '@/engine/scoring'
import { collectWeakItems, countDue } from '@/engine/session'
import { WORDS } from '@/data/words'
import { PHRASES } from '@/data/phrases'
import { toMinutes } from '@/utils/time'

export function HomePage() {
  const stats = useAppStore((state) => state.stats)
  const items = useAppStore((state) => state.items)
  const today = useToday()

  const overall = useMemo(() => overallStats(items, stats), [items, stats])
  const due = useMemo(() => countDue(items), [items])
  const weakCount = useMemo(() => collectWeakItems(items).length, [items])

  const minutesToday = toMinutes(today?.studiedMs ?? 0)
  const hasStarted = stats.totalExercises > 0

  return (
    <div className="flex flex-col">
      <header className="pt-6 text-center">
        <h1 className="cyr text-[clamp(2.6rem,13vw,3.6rem)] font-black leading-none tracking-tight">
          <span lang="ru">РУССКИЙ</span>
        </h1>
        <p className="mt-2 text-sm text-ink-faint">Allenamento quotidiano</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <StatCard
          icon="🔥"
          label="Serie attuale"
          value={stats.currentStreak}
          hint={stats.currentStreak === 1 ? 'giorno' : 'giorni'}
        />
        <StatCard
          icon="📚"
          label="Parole imparate"
          value={overall.wordsLearned}
          hint={`su ${WORDS.length} disponibili`}
        />
        <StatCard
          icon="🎯"
          label="Padronanza"
          value={`${Math.round(overall.overallMastery * 100)}%`}
          hint={`${overall.wordsSeen + overall.phrasesSeen} elementi visti`}
        />
        <StatCard
          icon="⏱"
          label="Minuti oggi"
          value={minutesToday}
          hint={today ? `${today.exercises} esercizi` : 'nessuna attività'}
        />
      </div>

      <Link
        to="/sessione"
        className="mt-5 flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-accent px-5 py-4 text-white transition-colors hover:bg-accent/90 active:bg-accent/80"
      >
        <span className="text-left">
          <span className="block text-base font-bold uppercase tracking-wide">
            {hasStarted ? 'Continua sessione' : 'Inizia la prima sessione'}
          </span>
          <span className="block text-xs text-white/80">
            Alfabeto → Parole → Ascolto → Frasi → Viaggio → Ripasso
          </span>
        </span>
        <span aria-hidden className="text-2xl">
          →
        </span>
      </Link>

      {due > 0 && (
        <p className="mt-2.5 text-center text-xs text-ink-muted">
          <span className="font-semibold text-accent">{due}</span> element
          {due === 1 ? 'o' : 'i'} da ripassare oggi
        </p>
      )}

      <Section title="Allenamento libero" className="mt-8">
        <div className="grid grid-cols-2 gap-2.5">
          <Tile to="/allenamento/alfabeto" icon="🔤" label="Alfabeto" hint="33 lettere" />
          <Tile
            to="/allenamento/vocabolario"
            icon="📚"
            label="Vocabolario"
            hint={`${WORDS.length} parole`}
          />
          <Tile to="/allenamento/ascolto" icon="🎧" label="Ascolto" hint="Comprensione orale" />
          <Tile to="/allenamento/pronuncia" icon="🎙" label="Pronuncia" hint="Microfono" />
          <Tile to="/allenamento/frasi" icon="🧩" label="Costruisci frase" hint="Sentence lab" />
          <Tile to="/conversazioni" icon="💬" label="Conversazioni" hint="Situazioni reali" />
          <Tile
            to="/viaggio"
            icon="✈️"
            label="Russo da viaggio"
            hint={`${PHRASES.length} frasi`}
          />
          <Tile to="/errori" icon="❌" label="I miei errori" badge={weakCount} hint="Punti deboli" />
        </div>
      </Section>

      <Section title="Riepilogo" className="mt-8">
        <div className="card space-y-4 p-4">
          <ProgressBar
            value={overall.lettersMastered / 33}
            label="Alfabeto padroneggiato"
            showValue
            tone="success"
          />
          <ProgressBar
            value={overall.wordsLearned / Math.max(1, WORDS.length)}
            label="Vocabolario"
            showValue
          />
          <ProgressBar
            value={overall.phrasesLearned / Math.max(1, PHRASES.length)}
            label="Frasi"
            showValue
          />
          <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-ink-muted">Precisione complessiva</span>
            <span className="font-bold tabular-nums">
              {stats.totalExercises === 0 ? '—' : `${Math.round(overall.accuracy * 100)}%`}
            </span>
          </div>
          <Link
            to="/statistiche"
            className="block text-center text-sm font-medium text-accent hover:underline"
          >
            Vedi tutte le statistiche →
          </Link>
        </div>
      </Section>
    </div>
  )
}
