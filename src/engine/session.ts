import type { Exercise, ExerciseType } from '@/types/exercise'
import type { ItemProgress, SessionStageId } from '@/types/progress'
import type { Phrase, Word, Scenario } from '@/types/content'
import { ALPHABET, ALPHABET_BY_ID } from '@/data/alphabet'
import { WORDS, WORDS_BY_ID } from '@/data/words'
import { PHRASES, PHRASES_BY_ID } from '@/data/phrases'
import { SCENARIOS } from '@/data/scenarios'
import { getAllItems } from '@/db/progressRepo'
import { createItemProgress } from '@/db/progressRepo'
import { itemKey } from '@/types/progress'
import { buildLetterQueue, selectItems, toProgressMap, MISTAKES_MIX } from './scheduler'
import { buildPhraseExercise, buildWordExercise, buildLetterExercise } from './exerciseFactory'
import { isWeak } from './mastery'
import { createRng, seedFromString, type Rng } from '@/utils/random'
import { REPLYABLE_PHRASE_IDS } from './exerciseFactory'

/**
 * Session planning.
 *
 * A session is a sequence of stages. Everything except the warm-up is
 * pre-generated so the progress bar is honest; the warm-up is open-ended
 * (target-based) and the final review depends on what you actually got wrong.
 */

export const STAGE_ORDER: SessionStageId[] = [
  'warmup',
  'words',
  'listening',
  'sentences',
  'travel',
  'review',
]

export const STAGE_LABELS: Record<SessionStageId, string> = {
  warmup: 'WARM-UP',
  words: 'PAROLE',
  listening: 'ASCOLTO',
  sentences: 'FRASI',
  travel: 'VIAGGIO',
  review: 'RIPASSO',
}

export const STAGE_TITLES: Record<SessionStageId, string> = {
  warmup: 'Alfabeto',
  words: 'Vocabolario',
  listening: 'Ascolto',
  sentences: 'Frasi',
  travel: 'Situazione reale',
  review: 'Ripasso finale',
}

export interface SessionPlan {
  seed: number
  createdAt: number
  /** Letter ids, in the order the warm-up should present them. */
  warmupQueue: string[]
  warmupTarget: number
  warmupMs: number
  words: Exercise[]
  listening: Exercise[]
  sentences: Exercise[]
  scenario: Scenario
  /** Everything the user is about to see, for the "new items" counter. */
  newItemKeys: string[]
}

export interface PlanOptions {
  allowSpeech: boolean
  wordsPerSession: number
  warmupTarget: number
  warmupMinutes: number
  now?: number
  /** Overrides the daily seed — used by tests. */
  seed?: number
}

interface ProgressLookup {
  map: Map<string, ItemProgress>
  get(kind: 'letter' | 'word' | 'phrase', id: string): ItemProgress
}

function lookup(items: ItemProgress[], now: number): ProgressLookup {
  const map = toProgressMap(items)
  return {
    map,
    get: (kind, id) => map.get(itemKey(kind, id)) ?? createItemProgress(kind, id, now),
  }
}

/** A different pack every session: the seed changes with the clock. */
export function dailySeed(now = Date.now()): number {
  return seedFromString(`session-${Math.floor(now / 60_000)}`)
}

export async function buildSessionPlan(options: PlanOptions): Promise<SessionPlan> {
  const now = options.now ?? Date.now()
  const seed = options.seed ?? dailySeed(now)
  const rng = createRng(seed)
  const items = await getAllItems()
  const progress = lookup(items, now)

  const warmupQueue = buildLetterQueue(
    ALPHABET.map((l) => l.id),
    progress.map,
    rng,
    Math.max(40, options.warmupTarget * 2),
    now,
  )

  // ------------------------------------------------------------ vocabulary
  const wordPool = WORDS.map((w) => ({ id: w.id, order: w.frequencyRank }))
  const scheduledWords = selectItems('word', wordPool, progress.map, rng, {
    count: options.wordsPerSession,
    now,
  })
  const words = scheduledWords.map((entry) =>
    buildWordExercise(WORDS_BY_ID[entry.item.id], entry.progress, rng, {
      allowSpeech: options.allowSpeech,
    }),
  )

  // ------------------------------------------------------------- listening
  const usedWordIds = new Set(scheduledWords.map((s) => s.item.id))
  const listeningWords = selectItems('word', wordPool, progress.map, rng, {
    count: 4,
    now,
    exclude: usedWordIds,
  })
  const phrasePool = PHRASES.map((p, index) => ({ id: p.id, order: index }))
  const listeningPhrases = selectItems('phrase', phrasePool, progress.map, rng, {
    count: 4,
    now,
  })

  const listening: Exercise[] = [
    ...listeningWords.map((entry) =>
      buildWordExercise(WORDS_BY_ID[entry.item.id], entry.progress, rng, {
        allowSpeech: options.allowSpeech,
        forceType: rng.next() < 0.5 ? 'audio-it' : 'audio-ru',
      }),
    ),
    ...listeningPhrases.map((entry) =>
      buildPhraseExercise(PHRASES_BY_ID[entry.item.id], entry.progress, rng, {
        allowSpeech: options.allowSpeech,
        forceType: 'phrase-listen',
      }),
    ),
  ]

  // ------------------------------------------------------------- sentences
  const usedPhraseIds = new Set(listeningPhrases.map((s) => s.item.id))
  const sentencePhrases = selectItems('phrase', phrasePool, progress.map, rng, {
    count: 8,
    now,
    exclude: usedPhraseIds,
    filter: (item) => {
      const phrase = PHRASES_BY_ID[item.id]
      return phrase.russian.split(/\s+/).length >= 2
    },
  })

  const sentenceTypes: ExerciseType[] = ['phrase-build', 'phrase-gap', 'phrase-it-ru']
  const sentences = sentencePhrases.map((entry, index) => {
    const phrase = PHRASES_BY_ID[entry.item.id]
    let forced: ExerciseType | undefined = sentenceTypes[index % sentenceTypes.length]
    if (forced === 'phrase-build' && phrase.russian.split(/\s+/).length < 3) {
      forced = 'phrase-it-ru'
    }
    // Sprinkle in a conversational reply when the phrase supports one.
    if (REPLYABLE_PHRASE_IDS.includes(phrase.id) && rng.next() < 0.5) {
      forced = 'phrase-reply'
    }
    return buildPhraseExercise(phrase, entry.progress, rng, {
      allowSpeech: options.allowSpeech,
      forceType: forced,
    })
  })

  // ---------------------------------------------------------------- travel
  const scenario = pickScenario(rng, items, now)

  const newItemKeys = [...words, ...listening, ...sentences]
    .filter((ex) => ex.isNew)
    .map((ex) => ex.itemKey)

  return {
    seed,
    createdAt: now,
    warmupQueue,
    warmupTarget: options.warmupTarget,
    warmupMs: options.warmupMinutes * 60_000,
    words,
    listening,
    sentences,
    scenario,
    newItemKeys: [...new Set(newItemKeys)],
  }
}

/**
 * Prefers a scenario you have not completed recently. Scenario progress is
 * tracked through the phrases it teaches, so "least practised category" is a
 * good enough proxy without inventing a separate table.
 */
function pickScenario(rng: Rng, items: ItemProgress[], now: number): Scenario {
  const byKey = toProgressMap(items)
  const scored = SCENARIOS.map((scenario) => {
    const related = PHRASES.filter((p) => p.category === scenario.category)
    if (related.length === 0) return { scenario, score: 100 }
    let total = 0
    for (const phrase of related) {
      const progress = byKey.get(itemKey('phrase', phrase.id))
      total += progress ? progress.mastery : 0
    }
    const avgMastery = total / related.length
    const staleness = related.reduce((max, phrase) => {
      const progress = byKey.get(itemKey('phrase', phrase.id))
      const seenAt = progress?.lastSeenAt ?? 0
      return Math.max(max, now - seenAt)
    }, 0)
    return { scenario, score: (1 - avgMastery) * 50 + Math.min(50, staleness / 86_400_000) }
  })

  // Pick among the three most "deserving" so it does not get monotonous.
  return rng.pick(scored.toSorted((a, b) => b.score - a.score).slice(0, 3)).scenario
}

/** Exercises for the end-of-session review, built from what went wrong. */
export function buildReviewExercises(
  wrongKeys: string[],
  progressByKey: Map<string, ItemProgress>,
  rng: Rng,
  allowSpeech: boolean,
  now = Date.now(),
): Exercise[] {
  const exercises: Exercise[] = []
  for (const key of [...new Set(wrongKeys)].slice(0, 10)) {
    const [kind, id] = splitKey(key)
    const progress = progressByKey.get(key) ?? createItemProgress(kind, id, now)
    const options = { allowSpeech }
    if (kind === 'letter' && ALPHABET_BY_ID[id]) {
      exercises.push(buildLetterExercise(ALPHABET_BY_ID[id], progress, rng, options))
    } else if (kind === 'word' && WORDS_BY_ID[id]) {
      exercises.push(buildWordExercise(WORDS_BY_ID[id], progress, rng, options))
    } else if (kind === 'phrase' && PHRASES_BY_ID[id]) {
      exercises.push(buildPhraseExercise(PHRASES_BY_ID[id], progress, rng, options))
    }
  }
  return exercises
}

function splitKey(key: string): ['letter' | 'word' | 'phrase', string] {
  const idx = key.indexOf(':')
  return [key.slice(0, idx) as 'letter' | 'word' | 'phrase', key.slice(idx + 1)]
}

// ---------------------------------------------------------------------------
// Free-training / mistakes builders
// ---------------------------------------------------------------------------

export interface FreeTrainingOptions {
  count: number
  allowSpeech: boolean
  forceType?: ExerciseType
  category?: string
  now?: number
  seed?: number
}

export async function buildWordTraining(options: FreeTrainingOptions): Promise<Exercise[]> {
  const now = options.now ?? Date.now()
  const rng = createRng(options.seed ?? dailySeed(now))
  const items = await getAllItems()
  const progress = lookup(items, now)

  const pool = WORDS.filter((w) => !options.category || w.category === options.category).map(
    (w) => ({ id: w.id, order: w.frequencyRank }),
  )

  const scheduled = selectItems('word', pool, progress.map, rng, { count: options.count, now })
  return scheduled.map((entry) =>
    buildWordExercise(WORDS_BY_ID[entry.item.id], entry.progress, rng, {
      allowSpeech: options.allowSpeech,
      forceType: options.forceType,
    }),
  )
}

export async function buildPhraseTraining(options: FreeTrainingOptions): Promise<Exercise[]> {
  const now = options.now ?? Date.now()
  const rng = createRng(options.seed ?? dailySeed(now))
  const items = await getAllItems()
  const progress = lookup(items, now)

  const pool = PHRASES.filter((p) => !options.category || p.category === options.category)
    .filter((p) => !options.forceType || supportsType(p, options.forceType))
    .map((p, index) => ({ id: p.id, order: index }))

  const scheduled = selectItems('phrase', pool, progress.map, rng, { count: options.count, now })
  return scheduled.map((entry) =>
    buildPhraseExercise(PHRASES_BY_ID[entry.item.id], entry.progress, rng, {
      allowSpeech: options.allowSpeech,
      forceType: options.forceType,
    }),
  )
}

function supportsType(phrase: Phrase, type: ExerciseType): boolean {
  const words = phrase.russian.split(/\s+/).length
  if (type === 'phrase-build') return words >= 3
  if (type === 'phrase-gap') return words >= 2
  if (type === 'phrase-reply') return REPLYABLE_PHRASE_IDS.includes(phrase.id)
  return true
}

export async function buildAlphabetTraining(options: FreeTrainingOptions): Promise<string[]> {
  const now = options.now ?? Date.now()
  const rng = createRng(options.seed ?? dailySeed(now))
  const items = await getAllItems()
  const progress = toProgressMap(items)
  return buildLetterQueue(
    ALPHABET.map((l) => l.id),
    progress,
    rng,
    options.count,
    now,
  )
}

export interface WeakItem {
  key: string
  kind: 'letter' | 'word' | 'phrase'
  id: string
  progress: ItemProgress
  label: string
  sublabel: string
}

/** Everything the user is currently struggling with, worst first. */
export function collectWeakItems(items: ItemProgress[]): WeakItem[] {
  return items
    .filter(isWeak)
    .map((progress) => {
      const [kind, id] = splitKey(progress.key)
      if (kind === 'letter') {
        const letter = ALPHABET_BY_ID[id]
        if (!letter) return null
        return {
          key: progress.key,
          kind,
          id,
          progress,
          label: letter.upper,
          sublabel: letter.pronunciation,
        }
      }
      if (kind === 'word') {
        const word = WORDS_BY_ID[id]
        if (!word) return null
        return { key: progress.key, kind, id, progress, label: word.russian, sublabel: word.italian }
      }
      const phrase = PHRASES_BY_ID[id]
      if (!phrase) return null
      return { key: progress.key, kind, id, progress, label: phrase.russian, sublabel: phrase.italian }
    })
    .filter((entry): entry is WeakItem => entry !== null)
    .toSorted((a, b) => a.progress.mastery - b.progress.mastery)
}

/** Builds a training block focused almost entirely on weak material. */
export async function buildMistakesTraining(options: {
  count: number
  allowSpeech: boolean
  now?: number
  seed?: number
}): Promise<{ exercises: Exercise[]; letterQueue: string[] }> {
  const now = options.now ?? Date.now()
  const rng = createRng(options.seed ?? dailySeed(now))
  const items = await getAllItems()
  const progress = lookup(items, now)
  const weak = collectWeakItems(items)

  const weakLetters = weak.filter((w) => w.kind === 'letter').map((w) => w.id)
  const exercises: Exercise[] = []

  const weakWordIds = new Set(weak.filter((w) => w.kind === 'word').map((w) => w.id))
  const weakPhraseIds = new Set(weak.filter((w) => w.kind === 'phrase').map((w) => w.id))

  const wordPool = WORDS.filter((w) => weakWordIds.has(w.id)).map((w) => ({
    id: w.id,
    order: w.frequencyRank,
  }))
  const phrasePool = PHRASES.filter((p) => weakPhraseIds.has(p.id)).map((p, i) => ({
    id: p.id,
    order: i,
  }))

  const wordCount = Math.min(wordPool.length, Math.ceil(options.count * 0.6))
  const phraseCount = Math.min(phrasePool.length, options.count - wordCount)

  for (const entry of selectItems('word', wordPool, progress.map, rng, {
    count: wordCount,
    now,
    mix: MISTAKES_MIX,
  })) {
    exercises.push(
      buildWordExercise(WORDS_BY_ID[entry.item.id], entry.progress, rng, {
        allowSpeech: options.allowSpeech,
      }),
    )
  }

  for (const entry of selectItems('phrase', phrasePool, progress.map, rng, {
    count: phraseCount,
    now,
    mix: MISTAKES_MIX,
  })) {
    exercises.push(
      buildPhraseExercise(PHRASES_BY_ID[entry.item.id], entry.progress, rng, {
        allowSpeech: options.allowSpeech,
      }),
    )
  }

  return {
    exercises: rng.shuffle(exercises),
    letterQueue: weakLetters.length > 0 ? buildLetterQueue(weakLetters, progress.map, rng, Math.min(12, weakLetters.length * 3), now) : [],
  }
}

/** Convenience for the UI: how many items are due right now. */
export function countDue(items: ItemProgress[], now = Date.now()): number {
  return items.filter((item) => item.seenCount > 0 && item.nextReviewAt <= now).length
}

export type { Word, Phrase }
