import type { Word, WordCategory } from '@/types/content'
import { CORE_WORDS } from './core'
import { NUMBER_TIME_WORDS } from './numbers-time'
import { FOOD_WORDS } from './food'
import { TRAVEL_WORDS } from './travel'
import { HOME_SHOPPING_WORDS } from './home-shopping'
import { VERB_WORDS } from './verbs'
import { ADJECTIVE_WORDS } from './adjectives'
import { LIFE_WORDS } from './life'

/**
 * The full vocabulary dataset, sorted by frequency so the scheduler can simply
 * walk the list when it needs "the next new word".
 *
 * Source: hand-curated from standard Russian frequency lists (Sharoff's
 * frequency dictionary of modern Russian ordering was used as a sanity check
 * for the first few hundred entries) plus travel-specific vocabulary. Every
 * entry was reviewed by hand — nothing here is machine translated.
 */
export const WORDS: Word[] = [
  ...CORE_WORDS,
  ...NUMBER_TIME_WORDS,
  ...FOOD_WORDS,
  ...TRAVEL_WORDS,
  ...HOME_SHOPPING_WORDS,
  ...VERB_WORDS,
  ...ADJECTIVE_WORDS,
  ...LIFE_WORDS,
].toSorted((a, b) => a.frequencyRank - b.frequencyRank)

export const WORDS_BY_ID: Record<string, Word> = Object.fromEntries(
  WORDS.map((w) => [w.id, w]),
)

export function getWord(id: string): Word | undefined {
  return WORDS_BY_ID[id]
}

const byCategory = new Map<WordCategory, Word[]>()
for (const word of WORDS) {
  const list = byCategory.get(word.category)
  if (list) list.push(word)
  else byCategory.set(word.category, [word])
}

export function wordsByCategory(category: WordCategory): Word[] {
  return byCategory.get(category) ?? []
}

/** Categories that actually contain at least one word, in dataset order. */
export const ACTIVE_WORD_CATEGORIES = [...byCategory.keys()]

/** Words that can be used by the "emoji → russian" exercise. */
export const VISUAL_WORDS: Word[] = WORDS.filter((w) => Boolean(w.visualHint))
