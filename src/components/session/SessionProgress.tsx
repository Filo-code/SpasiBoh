import type { SessionStageId } from '@/types/progress'
import { STAGE_LABELS, STAGE_ORDER } from '@/engine/session'

interface Props {
  current: SessionStageId
  completed: SessionStageId[]
}

/**
 * `WARM-UP ● PAROLE ○ ASCOLTO ○ …`
 *
 * Horizontally scrollable on narrow phones so the labels never wrap.
 */
export function SessionProgress({ current, completed }: Props) {
  return (
    <nav aria-label="Fasi della sessione" className="no-scrollbar -mx-4 overflow-x-auto px-4">
      <ol className="flex min-w-max items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em]">
        {STAGE_ORDER.map((stage, index) => {
          const isDone = completed.includes(stage)
          const isCurrent = stage === current
          return (
            <li key={stage} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-ink-faint/40">
                  ·
                </span>
              )}
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className={
                  isCurrent
                    ? 'text-accent'
                    : isDone
                      ? 'text-success'
                      : 'text-ink-faint/60'
                }
              >
                <span aria-hidden className="mr-1">
                  {isDone ? '●' : isCurrent ? '●' : '○'}
                </span>
                {STAGE_LABELS[stage]}
                <span className="sr-only">
                  {isDone ? ' completata' : isCurrent ? ' in corso' : ' da fare'}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
