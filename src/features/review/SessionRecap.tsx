import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { SessionRecord } from '@/types/progress'
import { STAGE_TITLES } from '@/engine/session'
import { summarizeSession } from '@/engine/scoring'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RussianText } from '@/components/ui/RussianText'
import { formatMinutes } from '@/utils/time'
import { ALPHABET_BY_ID } from '@/data/alphabet'
import { WORDS_BY_ID } from '@/data/words'
import { PHRASES_BY_ID } from '@/data/phrases'
import { parseItemKey } from '@/types/progress'
import { useAppStore } from '@/store/appStore'

interface Props {
  session: SessionRecord
  streakBefore: number
}

/** The end-of-session report. */
export function SessionRecap({ session, streakBefore }: Props) {
  const stats = useAppStore((state) => state.stats)
  const summary = useMemo(() => summarizeSession(session.stages), [session.stages])

  const toReview = useMemo(() => {
    const seen = new Set<string>()
    const letters: string[] = []
    const others: { text: string; sub: string }[] = []

    for (const key of session.weakKeys) {
      if (seen.has(key)) continue
      seen.add(key)
      const { kind, id } = parseItemKey(key)
      if (kind === 'letter') {
        const letter = ALPHABET_BY_ID[id]
        if (letter) letters.push(letter.upper)
      } else if (kind === 'word') {
        const word = WORDS_BY_ID[id]
        if (word) others.push({ text: word.russian, sub: word.italian })
      } else {
        const phrase = PHRASES_BY_ID[id]
        if (phrase) others.push({ text: phrase.russian, sub: phrase.italian })
      }
    }
    return { letters, others: others.slice(0, 8) }
  }, [session.weakKeys])

  const streakGained = stats.currentStreak > streakBefore

  return (
    <div className="flex flex-1 flex-col pt-8">
      <header className="text-center">
        <p className="text-4xl" aria-hidden>
          {summary.accuracy >= 0.8 ? '🎯' : summary.accuracy >= 0.6 ? '💪' : '📖'}
        </p>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Sessione completata</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatMinutes(session.durationMs)} minuti · {session.total} esercizi
        </p>
      </header>

      <div className="mt-7 space-y-3.5">
        {summary.stages.map((stage) => (
          <div key={stage.stage}>
            <ProgressBar
              value={stage.accuracy}
              label={STAGE_TITLES[stage.stage]}
              showValue
              tone={stage.accuracy >= 0.8 ? 'success' : stage.accuracy >= 0.6 ? 'accent' : 'warn'}
            />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
        <div className="card px-2 py-3">
          <div className="text-xl font-bold tabular-nums">{session.correct}</div>
          <div className="text-[0.68rem] text-ink-faint">corrette</div>
        </div>
        <div className="card px-2 py-3">
          <div className="text-xl font-bold tabular-nums text-danger">
            {session.total - session.correct}
          </div>
          <div className="text-[0.68rem] text-ink-faint">errori</div>
        </div>
        <div className="card px-2 py-3">
          <div className="text-xl font-bold tabular-nums text-success">{session.newItems}</div>
          <div className="text-[0.68rem] text-ink-faint">nuovi</div>
        </div>
      </div>

      {(summary.strongestStage || summary.weakestStage) && (
        <div className="card mt-4 space-y-2 p-4 text-sm">
          {summary.strongestStage && (
            <p>
              <span className="text-ink-faint">Più forte: </span>
              <span className="font-semibold text-success">
                {STAGE_TITLES[summary.strongestStage.stage]}
              </span>
            </p>
          )}
          {summary.weakestStage && summary.weakestStage !== summary.strongestStage && (
            <p>
              <span className="text-ink-faint">Da migliorare: </span>
              <span className="font-semibold text-warn">
                {STAGE_TITLES[summary.weakestStage.stage]}
              </span>
            </p>
          )}
          <p>
            <span className="text-ink-faint">Serie: </span>
            <span className="font-semibold">
              {stats.currentStreak} giorn{stats.currentStreak === 1 ? 'o' : 'i'}
              {streakGained && <span className="ml-1 text-success">+1 🔥</span>}
            </span>
          </p>
        </div>
      )}

      {(toReview.letters.length > 0 || toReview.others.length > 0) && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Da ripassare
          </h2>
          {toReview.letters.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {toReview.letters.map((letter) => (
                <span
                  key={letter}
                  className="cyr rounded-lg border border-danger/40 bg-danger-soft px-3 py-1.5 text-xl font-bold text-danger"
                >
                  {letter}
                </span>
              ))}
            </div>
          )}
          {toReview.others.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {toReview.others.map((entry) => (
                <li
                  key={entry.text}
                  className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <RussianText size="sm">{entry.text}</RussianText>
                  <span className="shrink-0 text-xs text-ink-faint">{entry.sub}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="mt-8 space-y-2.5 pb-4">
        <Link to="/">
          <Button fullWidth size="lg">
            Torna alla home
          </Button>
        </Link>
        {session.weakKeys.length > 0 && (
          <Link to="/errori">
            <Button fullWidth variant="secondary">
              Allenati sugli errori
            </Button>
          </Link>
        )}
      </div>
    </div>
  )
}
