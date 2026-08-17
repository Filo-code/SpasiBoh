import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnswerResult, ChoiceOption, Exercise } from '@/types/exercise'
import { ExerciseCard } from './ExerciseCard'
import { MultipleChoice } from './MultipleChoice'
import { WordBlocks } from './WordBlocks'
import { MicrophoneButton } from './MicrophoneButton'
import { ResultFeedback } from './ResultFeedback'
import { Button } from '@/components/ui/Button'
import { useMicrophone } from '@/hooks/useMicrophone'
import { useAudio } from '@/hooks/useAudio'
import { blocksMatch, fromBlocks } from '@/utils/text'
import { useAppStore } from '@/store/appStore'

interface Props {
  exercise: Exercise
  onAnswered(result: AnswerResult): void
  onNext(): void
  /** Label of the continue button — "Continua" or "Termina". */
  nextLabel?: string
}

/**
 * Renders any exercise and manages the attempt → feedback → continue loop.
 *
 * Nothing about the answer is visible until the user has committed: the
 * feedback panel (transliteration, translation, audio) mounts only after
 * `answered` flips.
 */
export function ExerciseRunner({ exercise, onAnswered, onNext, nextLabel = 'Continua' }: Props) {
  const [answered, setAnswered] = useState(false)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [chosenBlocks, setChosenBlocks] = useState<string[]>([])
  const [given, setGiven] = useState<string | undefined>()
  const [skipped, setSkipped] = useState(false)
  const [feedbackNote, setFeedbackNote] = useState<string | undefined>()

  const startedAtRef = useRef<number>(Date.now())
  const mic = useMicrophone()
  const audio = useAudio()
  const autoPlay = useAppStore((state) => state.settings.autoPlayAudio)
  const continueRef = useRef<HTMLButtonElement>(null)

  // Reset everything when the exercise changes.
  useEffect(() => {
    setAnswered(false)
    setCorrect(null)
    setSelectedId(null)
    setChosenBlocks([])
    setGiven(undefined)
    setSkipped(false)
    setFeedbackNote(undefined)
    mic.reset()
    startedAtRef.current = Date.now()
    // `mic` is stable enough in practice; re-running on its identity would
    // reset the exercise mid-attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.uid])

  // Listening exercises play themselves once.
  useEffect(() => {
    if (!exercise.audioIsPrompt || !exercise.audioText || !autoPlay) return
    const id = window.setTimeout(() => audio.play(exercise.audioText!, 'normal'), 220)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.uid])

  const finish = useCallback(
    (isCorrect: boolean, userAnswer?: string, wasSkipped = false) => {
      setAnswered(true)
      setCorrect(isCorrect)
      setGiven(userAnswer)
      setSkipped(wasSkipped)
      onAnswered({
        correct: isCorrect,
        given: userAnswer,
        elapsedMs: Date.now() - startedAtRef.current,
        skipped: wasSkipped,
      })
    },
    [onAnswered],
  )

  const handleSelect = useCallback(
    (option: ChoiceOption) => {
      if (answered) return
      setSelectedId(option.id)
      finish(option.correct, option.label)
    },
    [answered, finish],
  )

  const checkBlocks = useCallback(() => {
    if (answered || chosenBlocks.length === 0) return
    const target = exercise.solutionBlocks?.join(exercise.type === 'word-spell' ? '' : ' ') ?? ''
    const produced = exercise.type === 'word-spell' ? chosenBlocks.join('') : fromBlocks(chosenBlocks)
    const isCorrect =
      exercise.type === 'word-spell'
        ? produced.toLowerCase() === target.toLowerCase()
        : blocksMatch(chosenBlocks, target)
    finish(isCorrect, produced)
  }, [answered, chosenBlocks, exercise.solutionBlocks, exercise.type, finish])

  // ------------------------------------------------------------- speech
  const speechTarget = exercise.accepted?.[0] ?? exercise.reveal.russian

  useEffect(() => {
    if (mic.state !== 'done' || !mic.result || answered) return
    const result = mic.result

    // A recogniser that heard nothing is a microphone problem, not a wrong
    // answer: show why and let the user try again instead of scoring a miss.
    if (result.transcripts.length === 0) {
      setFeedbackNote(result.errorMessage ?? undefined)
      return
    }

    setFeedbackNote(
      'Il riconoscimento del browser verifica solo se la parola è stata capita, non la qualità dell\'accento.',
    )
    finish(result.matched, result.best || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.state, mic.result])

  const micUnavailable =
    !mic.supported || mic.result?.error === 'unsupported' || mic.result?.error === 'not-allowed'

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && answered) {
        event.preventDefault()
        onNext()
        return
      }
      if (answered || exercise.answerMode !== 'choice' || !exercise.options) return
      const index = Number.parseInt(event.key, 10) - 1
      if (Number.isInteger(index) && index >= 0 && index < exercise.options.length) {
        event.preventDefault()
        handleSelect(exercise.options[index])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [answered, exercise.answerMode, exercise.options, handleSelect, onNext])

  useEffect(() => {
    if (answered) continueRef.current?.focus()
  }, [answered])

  const blocksResetKey = useMemo(() => exercise.uid, [exercise.uid])

  return (
    <ExerciseCard
      prompt={exercise.prompt}
      promptMain={exercise.promptMain}
      promptIsCyrillic={exercise.promptIsCyrillic}
      promptEmoji={exercise.promptEmoji}
      promptSub={answered ? undefined : exercise.promptSub}
      audioPrompt={exercise.audioIsPrompt ? exercise.audioText : undefined}
      isNew={exercise.isNew}
      footer={
        answered ? (
          <Button ref={continueRef} fullWidth size="lg" onClick={onNext}>
            {nextLabel}
          </Button>
        ) : exercise.answerMode === 'build' ? (
          <Button fullWidth size="lg" disabled={chosenBlocks.length === 0} onClick={checkBlocks}>
            Verifica
          </Button>
        ) : null
      }
    >
      {exercise.answerMode === 'choice' && exercise.options && (
        <MultipleChoice
          options={exercise.options}
          selectedId={selectedId}
          answered={answered}
          onSelect={handleSelect}
        />
      )}

      {exercise.answerMode === 'build' && exercise.blocks && (
        <WordBlocks
          blocks={exercise.blocks}
          answered={answered}
          correct={correct}
          onChange={setChosenBlocks}
          resetKey={blocksResetKey}
          compact={exercise.type === 'word-spell'}
        />
      )}

      {!answered && exercise.answerMode === 'speech' && (
        <div className="flex flex-col items-center gap-4 py-2">
          {micUnavailable ? (
            <div className="w-full space-y-3">
              <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-ink-muted">
                {mic.result?.errorMessage ??
                  'Il riconoscimento vocale non è disponibile qui. Prova comunque a dirla ad alta voce, poi valuta tu stesso.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => finish(false, undefined, true)}>
                  Non ci sono riuscito
                </Button>
                <Button variant="secondary" onClick={() => finish(true, undefined, true)}>
                  Ci sono riuscito
                </Button>
              </div>
              <p className="text-center text-[0.7rem] text-ink-faint">
                Le prove auto-valutate non modificano le statistiche.
              </p>
            </div>
          ) : (
            <>
              <MicrophoneButton
                state={mic.state}
                onStart={() => mic.listen(speechTarget, exercise.accepted ?? [])}
                onStop={mic.stop}
              />
              {mic.result?.errorMessage && (
                <p className="text-center text-sm text-warn">{mic.result.errorMessage}</p>
              )}
              <button
                type="button"
                onClick={() => finish(false, undefined, true)}
                className="text-xs text-ink-faint underline underline-offset-4 hover:text-ink-muted"
              >
                Salta questo esercizio
              </button>
            </>
          )}
        </div>
      )}

      {answered && (
        <div className="mt-4">
          <ResultFeedback
            correct={correct === true}
            reveal={exercise.reveal}
            given={given}
            note={feedbackNote}
            skipped={skipped}
          />
        </div>
      )}
    </ExerciseCard>
  )
}
