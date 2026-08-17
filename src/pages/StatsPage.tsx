import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAppStore } from '@/store/appStore'
import { useDayHistory } from '@/hooks/useDayStats'
import { categoryMastery, overallStats } from '@/engine/scoring'
import { WORDS, ACTIVE_WORD_CATEGORIES, wordsByCategory } from '@/data/words'
import { PHRASES } from '@/data/phrases'
import { getRecentSessions } from '@/db/progressRepo'
import type { SessionRecord } from '@/types/progress'
import { formatMinutes, localDateKey, toMinutes } from '@/utils/time'
import type { WordCategory } from '@/types/content'

const WEEKDAYS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

export function StatsPage() {
  const stats = useAppStore((state) => state.stats)
  const items = useAppStore((state) => state.items)
  const days = useDayHistory(28)
  const [sessions, setSessions] = useState<SessionRecord[]>([])

  useEffect(() => {
    getRecentSessions(8).then(setSessions)
  }, [stats.totalSessions])

  const overall = useMemo(() => overallStats(items, stats), [items, stats])

  const totalsByCategory = useMemo(() => {
    const map = new Map<WordCategory, number>()
    for (const category of ACTIVE_WORD_CATEGORIES) {
      map.set(category, wordsByCategory(category).length)
    }
    return map
  }, [])

  const categories = useMemo(
    () => categoryMastery(items, totalsByCategory).filter((entry) => entry.seen > 0),
    [items, totalsByCategory],
  )

  const chart = useMemo(() => buildChart(days), [days])
  const maxMinutes = Math.max(1, ...chart.map((d) => d.minutes))

  return (
    <>
      <PageHeader title="Statistiche" subtitle="I tuoi numeri" back="/" />

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard icon="🔥" label="Serie attuale" value={stats.currentStreak} hint={`record: ${stats.bestStreak}`} />
        <StatCard icon="📅" label="Giorni di studio" value={stats.studyDays} />
        <StatCard icon="⏱" label="Minuti totali" value={toMinutes(stats.totalStudiedMs)} />
        <StatCard icon="🎓" label="Sessioni" value={stats.totalSessions} />
        <StatCard
          icon="✅"
          label="Esercizi"
          value={stats.totalExercises}
          hint={`${stats.totalCorrect} corretti`}
        />
        <StatCard
          icon="🎯"
          label="Precisione"
          value={stats.totalExercises === 0 ? '—' : `${Math.round(overall.accuracy * 100)}%`}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Attività (28 giorni)
        </h2>
        <div className="card p-4">
          <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Minuti studiati negli ultimi 28 giorni">
            {chart.map((day) => (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`${day.date}: ${day.minutes} minuti`}
              >
                <div
                  className={`w-full rounded-sm transition-all ${
                    day.minutes > 0 ? 'bg-accent' : 'bg-surface-2'
                  }`}
                  style={{
                    height: `${day.minutes > 0 ? Math.max(8, (day.minutes / maxMinutes) * 100) : 4}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-[3px] text-center text-[0.6rem] text-ink-faint">
            {chart.map((day) => (
              <span key={`label-${day.date}`} className="flex-1">
                {day.weekday}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Contenuti appresi
        </h2>
        <div className="card space-y-4 p-4">
          <ProgressBar
            value={overall.lettersMastered / 33}
            label={`Alfabeto — ${overall.lettersMastered}/33`}
            showValue
            tone="success"
          />
          <ProgressBar
            value={overall.wordsLearned / WORDS.length}
            label={`Parole imparate — ${overall.wordsLearned}/${WORDS.length}`}
            showValue
          />
          <ProgressBar
            value={overall.phrasesLearned / PHRASES.length}
            label={`Frasi imparate — ${overall.phrasesLearned}/${PHRASES.length}`}
            showValue
          />
          <p className="border-t border-border pt-3 text-xs text-ink-faint">
            Un elemento è considerato «imparato» quando la padronanza supera il 60%: richiede
            risposte corrette ripetute e distanziate nel tempo.
          </p>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Padronanza per categoria
          </h2>
          <div className="card space-y-3.5 p-4">
            {categories.map((entry) => (
              <ProgressBar
                key={entry.category}
                value={entry.mastery}
                label={`${entry.label} (${entry.seen}/${entry.total})`}
                showValue
                tone={entry.mastery >= 0.7 ? 'success' : entry.mastery >= 0.4 ? 'accent' : 'warn'}
              />
            ))}
          </div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Ultime sessioni
          </h2>
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li
                key={session.id ?? session.startedAt}
                className="card flex items-center justify-between gap-3 p-3.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {new Date(session.startedAt).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    <span className="ml-2 text-xs text-ink-faint">
                      {new Date(session.startedAt).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-ink-faint">
                    {formatMinutes(session.durationMs)} min · {session.total} esercizi
                  </div>
                </div>
                <span className="shrink-0 text-base font-bold tabular-nums">
                  {session.total === 0 ? '—' : `${Math.round((session.correct / session.total) * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

interface ChartDay {
  date: string
  minutes: number
  weekday: string
}

/** Fills in the missing days so the chart always shows a continuous 28-day window. */
function buildChart(days: { date: string; studiedMs: number }[]): ChartDay[] {
  const byDate = new Map(days.map((day) => [day.date, day.studiedMs]))
  const out: ChartDay[] = []
  const today = new Date()
  for (let offset = 27; offset >= 0; offset--) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    const key = localDateKey(date)
    out.push({
      date: key,
      minutes: toMinutes(byDate.get(key) ?? 0),
      weekday: WEEKDAYS[date.getDay()],
    })
  }
  return out
}
