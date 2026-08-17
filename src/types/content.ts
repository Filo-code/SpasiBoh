/**
 * Static learning content types.
 *
 * Everything in here is *authored* data that ships with the app. It never
 * changes at runtime and it is intentionally kept separate from the user's
 * progress (see `progress.ts`).
 */

export type WordCategory =
  | 'saluti'
  | 'persone'
  | 'numeri'
  | 'tempo'
  | 'casa'
  | 'cibo'
  | 'ristorante'
  | 'bar'
  | 'citta'
  | 'trasporti'
  | 'metro'
  | 'treno'
  | 'aeroporto'
  | 'hotel'
  | 'viaggio'
  | 'shopping'
  | 'verbi'
  | 'aggettivi'
  | 'domande'
  | 'conversazione'
  | 'emergenze'
  | 'natura'
  | 'corpo-salute'

export const WORD_CATEGORIES: readonly WordCategory[] = [
  'saluti',
  'persone',
  'numeri',
  'tempo',
  'casa',
  'cibo',
  'ristorante',
  'bar',
  'citta',
  'trasporti',
  'metro',
  'treno',
  'aeroporto',
  'hotel',
  'viaggio',
  'shopping',
  'verbi',
  'aggettivi',
  'domande',
  'conversazione',
  'emergenze',
  'natura',
  'corpo-salute',
]

export const CATEGORY_LABELS: Record<WordCategory, string> = {
  saluti: 'Saluti',
  persone: 'Persone',
  numeri: 'Numeri',
  tempo: 'Tempo',
  casa: 'Casa',
  cibo: 'Cibo',
  ristorante: 'Ristorante',
  bar: 'Bar',
  citta: 'Città',
  trasporti: 'Trasporti',
  metro: 'Metro',
  treno: 'Treno',
  aeroporto: 'Aeroporto',
  hotel: 'Hotel',
  viaggio: 'Viaggio',
  shopping: 'Shopping',
  verbi: 'Verbi',
  aggettivi: 'Aggettivi',
  domande: 'Domande',
  conversazione: 'Conversazione',
  emergenze: 'Emergenze',
  natura: 'Natura',
  'corpo-salute': 'Corpo e salute',
}

/** 1 = very easy / very frequent, 5 = advanced. */
export type Difficulty = 1 | 2 | 3 | 4 | 5

export interface Word {
  id: string
  russian: string
  italian: string
  /** Latin transliteration with the stressed vowel marked, e.g. `vakzàl`. */
  transliteration: string
  /** The stressed form written in Cyrillic with a combining acute, e.g. `вокза́л`. */
  stress: string
  category: WordCategory
  difficulty: Difficulty
  /** Lower is more frequent in everyday Russian. Used to introduce words in a sane order. */
  frequencyRank: number
  exampleSentence?: string
  exampleItalian?: string
  /** Emoji used by the "visual → russian" exercise. Only set where it is unambiguous. */
  visualHint?: string
  /** Short Italian note shown in the feedback panel (spelling traps, usage). */
  notes?: string
}

export type PhraseCategory =
  | 'conversazione'
  | 'aeroporto'
  | 'metro'
  | 'treno'
  | 'taxi'
  | 'ristorante'
  | 'bar'
  | 'hotel'
  | 'shopping'
  | 'orientamento'
  | 'emergenze'
  | 'numeri-tempo'

export const PHRASE_CATEGORIES: readonly PhraseCategory[] = [
  'conversazione',
  'aeroporto',
  'metro',
  'treno',
  'taxi',
  'ristorante',
  'bar',
  'hotel',
  'shopping',
  'orientamento',
  'emergenze',
  'numeri-tempo',
]

export const PHRASE_CATEGORY_LABELS: Record<PhraseCategory, string> = {
  conversazione: 'Conversazione',
  aeroporto: 'Aeroporto',
  metro: 'Metro',
  treno: 'Treno',
  taxi: 'Taxi',
  ristorante: 'Ristorante',
  bar: 'Bar',
  hotel: 'Hotel',
  shopping: 'Shopping',
  orientamento: 'Orientamento',
  emergenze: 'Emergenze',
  'numeri-tempo': 'Numeri e orari',
}

export const PHRASE_CATEGORY_ICONS: Record<PhraseCategory, string> = {
  conversazione: '👋',
  aeroporto: '✈️',
  metro: '🚇',
  treno: '🚆',
  taxi: '🚕',
  ristorante: '🍽️',
  bar: '🍺',
  hotel: '🏨',
  shopping: '🛍️',
  orientamento: '🧭',
  emergenze: '🆘',
  'numeri-tempo': '🕐',
}

export interface Phrase {
  id: string
  russian: string
  italian: string
  transliteration: string
  category: PhraseCategory
  difficulty: Difficulty
  /** Word ids or bare lemmas that this phrase reinforces. */
  keywords: string[]
  /** Text handed to speech synthesis — usually identical to `russian`. */
  audioText: string
  notes?: string
  alternativeTranslations?: string[]
  /**
   * Optional distractor blocks for the sentence-building game. The engine can
   * generate them, but hand-picked ones make the exercise much better.
   */
  distractors?: string[]
}

export interface AlphabetLetter {
  id: string
  upper: string
  lower: string
  /** Name of the letter in Cyrillic, e.g. `жэ`. */
  name: string
  /** How an Italian speaker should read it, e.g. `zh / come la j francese`. */
  pronunciation: string
  /** Short latin key used for multiple choice options, e.g. `zh`. */
  soundKey: string
  exampleWord: string
  exampleWordItalian: string
  exampleWordTranslit: string
  /** Letters that look or sound confusingly similar — used to build hard distractors. */
  confusableWith: string[]
  /** `false` for ъ and ь which have no sound of their own. */
  hasSound: boolean
  notes?: string
  order: number
}

export type ScenarioStepKind =
  | 'comprehension' // NPC speaks, you pick the Italian meaning
  | 'build' // you assemble the Russian reply from blocks
  | 'choice' // you pick the appropriate Russian reply
  | 'pronounce' // you say the Russian line out loud
  | 'info' // narrative beat, no answer required

export interface ScenarioStep {
  id: string
  kind: ScenarioStepKind
  /** What the NPC says just before this step, if anything. */
  npcRussian?: string
  npcItalian?: string
  npcTransliteration?: string
  /** Italian instruction shown above the exercise. */
  prompt: string
  /** The Russian target line for `build` / `pronounce` / `choice` steps. */
  targetRussian?: string
  targetItalian?: string
  targetTransliteration?: string
  /** Extra blocks mixed into the correct ones for `build` steps. */
  distractors?: string[]
  /** Options for `comprehension` (Italian) and `choice` (Russian) steps. */
  options?: string[]
  /** Index into `options`. */
  correctOption?: number
  hint?: string
}

export interface Scenario {
  id: string
  title: string
  icon: string
  /** One-line setup shown before the scenario starts. */
  intro: string
  category: PhraseCategory
  difficulty: Difficulty
  steps: ScenarioStep[]
}
