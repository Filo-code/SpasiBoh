import type { Phrase, PhraseCategory } from '@/types/content'
import { CONVERSATION_PHRASES } from './conversation'
import { TRANSPORT_PHRASES } from './transport'
import { FOOD_PHRASES } from './food'
import { STAY_PHRASES } from './stay'
import { HELP_PHRASES } from './help'

/**
 * Travel-oriented phrasebook. Every phrase is something you would plausibly
 * say (or hear) during a trip — no textbook filler like "the pen is on the
 * table".
 */
export const PHRASES: Phrase[] = [
  ...CONVERSATION_PHRASES,
  ...TRANSPORT_PHRASES,
  ...FOOD_PHRASES,
  ...STAY_PHRASES,
  ...HELP_PHRASES,
]

export const PHRASES_BY_ID: Record<string, Phrase> = Object.fromEntries(
  PHRASES.map((p) => [p.id, p]),
)

export function getPhrase(id: string): Phrase | undefined {
  return PHRASES_BY_ID[id]
}

const byCategory = new Map<PhraseCategory, Phrase[]>()
for (const phrase of PHRASES) {
  const list = byCategory.get(phrase.category)
  if (list) list.push(phrase)
  else byCategory.set(phrase.category, [phrase])
}

export function phrasesByCategory(category: PhraseCategory): Phrase[] {
  return byCategory.get(category) ?? []
}

export const ACTIVE_PHRASE_CATEGORIES = [...byCategory.keys()]

/** Phrases long enough to be worth assembling from blocks. */
export const BUILDABLE_PHRASES: Phrase[] = PHRASES.filter(
  (p) => p.russian.split(/\s+/).length >= 3,
)
