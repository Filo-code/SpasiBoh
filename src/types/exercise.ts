import type { ItemKey, ItemKind } from './progress'

/**
 * Every exercise the engine can produce. The renderer switches on `type`, so
 * adding a new exercise means: add a variant here, teach the factory to build
 * it, and add a renderer.
 */
export type ExerciseType =
  // alphabet
  | 'letter-sound' // Ж → which sound?
  | 'letter-recognize' // "zh" → which letter?
  | 'letter-audio' // hear a letter name → pick the letter
  | 'letter-pronounce' // say the letter out loud
  // vocabulary
  | 'ru-it' // A
  | 'it-ru' // B
  | 'audio-ru' // C
  | 'audio-it' // D
  | 'visual-ru' // E
  | 'word-pronounce' // F
  | 'word-spell' // rebuild the Russian word from letter blocks
  // sentences / phrases
  | 'phrase-listen' // hear a phrase → pick the Italian
  | 'phrase-it-ru' // Italian phrase → pick the Russian
  | 'phrase-build' // assemble the sentence from blocks
  | 'phrase-gap' // fill in the blank
  | 'phrase-reply' // pick the natural conversational answer
  | 'phrase-pronounce' // say the phrase out loud

export const ALPHABET_EXERCISES: ExerciseType[] = [
  'letter-sound',
  'letter-recognize',
  'letter-audio',
  'letter-pronounce',
]

export const WORD_EXERCISES: ExerciseType[] = [
  'ru-it',
  'it-ru',
  'audio-ru',
  'audio-it',
  'visual-ru',
  'word-pronounce',
  'word-spell',
]

export const PHRASE_EXERCISES: ExerciseType[] = [
  'phrase-listen',
  'phrase-it-ru',
  'phrase-build',
  'phrase-gap',
  'phrase-reply',
  'phrase-pronounce',
]

/** How the user answers — drives which renderer component is used. */
export type AnswerMode = 'choice' | 'build' | 'speech' | 'typing'

export interface ChoiceOption {
  id: string
  /** Text shown on the button. */
  label: string
  /** Rendered with the Cyrillic display font when true. */
  cyrillic?: boolean
  correct: boolean
}

/** The information revealed *after* the user has answered. Never before. */
export interface Reveal {
  russian: string
  italian: string
  transliteration: string
  /** Cyrillic with the stress mark, when available. */
  stressed?: string
  example?: string
  exampleItalian?: string
  note?: string
  /** What to speak when the user presses the audio button in the feedback panel. */
  audioText: string
}

export interface Exercise {
  /** Unique per generated instance, not per item. */
  uid: string
  type: ExerciseType
  answerMode: AnswerMode
  itemKey: ItemKey
  itemKind: ItemKind
  itemId: string
  /** Italian instruction, e.g. "Come si pronuncia?". */
  prompt: string
  /** The big thing shown in the middle of the card, if any. */
  promptMain?: string
  /** Rendered in the Cyrillic display font. */
  promptIsCyrillic?: boolean
  /** Emoji shown instead of text (visual exercises). */
  promptEmoji?: string
  /** Secondary line under the prompt. */
  promptSub?: string
  /** Text to auto-speak when the exercise appears (listening exercises). */
  audioText?: string
  /** True when the exercise is *only* solvable through audio. */
  audioIsPrompt?: boolean
  options?: ChoiceOption[]
  /** Correct sequence of blocks for `build` exercises. */
  solutionBlocks?: string[]
  /** Blocks presented to the user, already shuffled. */
  blocks?: string[]
  /** Accepted answers for `typing` / `speech` exercises (already normalised at compare time). */
  accepted?: string[]
  reveal: Reveal
  /** Marks the very first time an item is shown, so the UI can say "nuova parola". */
  isNew?: boolean
}

export interface AnswerResult {
  correct: boolean
  /** What the user actually produced (transcript, typed text, assembled sentence). */
  given?: string
  /** Milliseconds the user took. */
  elapsedMs: number
  /** True when the exercise was skipped / recognition unavailable → not scored. */
  skipped?: boolean
}
