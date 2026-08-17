import type { ReactNode } from 'react'
import { RussianText } from '@/components/ui/RussianText'
import { AudioButton } from './AudioButton'

interface Props {
  prompt: string
  promptMain?: string
  promptIsCyrillic?: boolean
  promptEmoji?: string
  promptSub?: string
  /** Audio that *is* the question — shown as a prominent play control. */
  audioPrompt?: string
  isNew?: boolean
  children: ReactNode
  footer?: ReactNode
}

/**
 * Shared exercise chrome: instruction, the thing being asked, and the answer
 * area. Everything an exercise needs to show *before* the answer goes here.
 */
export function ExerciseCard({
  prompt,
  promptMain,
  promptIsCyrillic,
  promptEmoji,
  promptSub,
  audioPrompt,
  isNew,
  children,
  footer,
}: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-5 text-center">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-ink-faint">
            {prompt}
          </h2>
          {isNew && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-accent">
              Nuovo
            </span>
          )}
        </div>

        {promptEmoji && (
          <div className="mt-6 text-[clamp(4rem,26vw,7rem)] leading-none" aria-label="indizio visivo">
            {promptEmoji}
          </div>
        )}

        {promptMain && (
          <div className="mt-5">
            {promptIsCyrillic ? (
              <RussianText size="lg" className="block break-words">
                {promptMain}
              </RussianText>
            ) : (
              <p className="text-2xl font-semibold leading-snug">{promptMain}</p>
            )}
          </div>
        )}

        {audioPrompt && (
          <div className="mt-6 flex justify-center">
            <AudioButton text={audioPrompt} />
          </div>
        )}

        {promptSub && <p className="mt-3 text-sm text-ink-muted">{promptSub}</p>}
      </div>

      <div className="flex-1">{children}</div>

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}
