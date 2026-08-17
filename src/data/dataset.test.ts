import { describe, expect, it } from 'vitest'
import { ALPHABET } from './alphabet'
import { WORDS, VISUAL_WORDS, wordsByCategory } from './words'
import { PHRASES, BUILDABLE_PHRASES } from './phrases'
import { SCENARIOS } from './scenarios'
import { WORD_CATEGORIES, PHRASE_CATEGORIES } from '@/types/content'
import { normalizeRussian } from '@/utils/text'

/**
 * Dataset integrity, enforced at test time as well as by `npm run validate:data`
 * so a bad edit fails CI even if nobody runs the script.
 */

describe('alphabet dataset', () => {
  it('has all 33 letters exactly once', () => {
    expect(ALPHABET).toHaveLength(33)
    expect(new Set(ALPHABET.map((l) => l.id)).size).toBe(33)
    expect(new Set(ALPHABET.map((l) => l.upper)).size).toBe(33)
  })

  it('gives every letter a distinguishable sound label', () => {
    expect(new Set(ALPHABET.map((l) => l.soundKey)).size).toBe(33)
  })

  it('only points confusableWith at letters that exist', () => {
    const ids = new Set(ALPHABET.map((l) => l.id))
    for (const letter of ALPHABET) {
      for (const other of letter.confusableWith) {
        expect(ids.has(other)).toBe(true)
        expect(other).not.toBe(letter.id)
      }
    }
  })

  it('marks ъ and ь as soundless', () => {
    expect(ALPHABET.find((l) => l.id === 'tvyordyy')!.hasSound).toBe(false)
    expect(ALPHABET.find((l) => l.id === 'myagkiy')!.hasSound).toBe(false)
  })
})

describe('vocabulary dataset', () => {
  it('holds at least 500 words', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(500)
  })

  it('has unique ids and unique Russian forms', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length)
    expect(new Set(WORDS.map((w) => w.russian)).size).toBe(WORDS.length)
  })

  it('fills every required field', () => {
    for (const word of WORDS) {
      expect(word.russian.trim()).not.toBe('')
      expect(word.italian.trim()).not.toBe('')
      expect(word.transliteration.trim()).not.toBe('')
      expect(word.stress.trim()).not.toBe('')
      expect(WORD_CATEGORIES).toContain(word.category)
      expect(word.difficulty).toBeGreaterThanOrEqual(1)
      expect(word.difficulty).toBeLessThanOrEqual(5)
    }
  })

  it('keeps the stressed form consistent with the plain one', () => {
    for (const word of WORDS) {
      expect(word.stress.replaceAll('́', '')).toBe(word.russian)
    }
  })

  it('is sorted by frequency so new words arrive in a sensible order', () => {
    for (let i = 1; i < WORDS.length; i++) {
      expect(WORDS[i].frequencyRank).toBeGreaterThanOrEqual(WORDS[i - 1].frequencyRank)
    }
  })

  it('has enough emoji-backed words for the visual exercise', () => {
    expect(VISUAL_WORDS.length).toBeGreaterThanOrEqual(60)
  })

  it('covers every category it declares', () => {
    for (const category of new Set(WORDS.map((w) => w.category))) {
      expect(wordsByCategory(category).length).toBeGreaterThan(0)
    }
  })

  it('has at least 4 words per category so multiple choice always works', () => {
    for (const category of new Set(WORDS.map((w) => w.category))) {
      expect(wordsByCategory(category).length).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('phrase dataset', () => {
  it('holds at least 150 phrases', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(150)
  })

  it('has unique ids and unique Russian forms', () => {
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length)
    expect(new Set(PHRASES.map((p) => p.russian)).size).toBe(PHRASES.length)
  })

  it('fills every required field and links real words', () => {
    const wordIds = new Set(WORDS.map((w) => w.id))
    for (const phrase of PHRASES) {
      expect(phrase.italian.trim()).not.toBe('')
      expect(phrase.transliteration.trim()).not.toBe('')
      expect(phrase.audioText.trim()).not.toBe('')
      expect(PHRASE_CATEGORIES).toContain(phrase.category)
      for (const keyword of phrase.keywords) {
        expect(wordIds.has(keyword)).toBe(true)
      }
    }
  })

  it('never hides a solution word inside its own distractors', () => {
    for (const phrase of PHRASES) {
      if (!phrase.distractors) continue
      const own = new Set(phrase.russian.toLowerCase().split(/\s+/))
      for (const distractor of phrase.distractors) {
        expect(own.has(distractor.toLowerCase())).toBe(false)
      }
    }
  })

  it('has enough multi-word phrases for the sentence builder', () => {
    expect(BUILDABLE_PHRASES.length).toBeGreaterThanOrEqual(100)
  })

  it('covers all the travel categories the home screen advertises', () => {
    const categories = new Set(PHRASES.map((p) => p.category))
    for (const required of ['aeroporto', 'metro', 'treno', 'ristorante', 'bar', 'hotel', 'emergenze'] as const) {
      expect(categories.has(required)).toBe(true)
    }
  })
})

describe('scenario dataset', () => {
  it('has at least 10 scenarios with 4–10 steps each', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10)
    for (const scenario of SCENARIOS) {
      expect(scenario.steps.length).toBeGreaterThanOrEqual(4)
      expect(scenario.steps.length).toBeLessThanOrEqual(10)
    }
  })

  it('has unique scenario and step ids', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
    for (const scenario of SCENARIOS) {
      const stepIds = scenario.steps.map((step) => step.id)
      expect(new Set(stepIds).size).toBe(stepIds.length)
    }
  })

  it('gives every answerable step a valid correct answer', () => {
    for (const scenario of SCENARIOS) {
      for (const step of scenario.steps) {
        if (step.kind === 'comprehension' || step.kind === 'choice') {
          expect(step.options!.length).toBeGreaterThanOrEqual(2)
          expect(step.correctOption).toBeGreaterThanOrEqual(0)
          expect(step.correctOption!).toBeLessThan(step.options!.length)
          expect(new Set(step.options).size).toBe(step.options!.length)
        }
        if (step.kind === 'build' || step.kind === 'pronounce') {
          expect(step.targetRussian!.trim()).not.toBe('')
          expect(step.targetItalian!.trim()).not.toBe('')
          expect(step.targetTransliteration!.trim()).not.toBe('')
        }
      }
    }
  })

  it('never puts a solution word among the build distractors', () => {
    for (const scenario of SCENARIOS) {
      for (const step of scenario.steps) {
        if (step.kind !== 'build' || !step.distractors) continue
        const own = new Set(step.targetRussian!.toLowerCase().split(/\s+/))
        for (const distractor of step.distractors) {
          expect(own.has(distractor.toLowerCase())).toBe(false)
        }
      }
    }
  })

  it('makes each scenario buildable into at least 3 interactive steps', () => {
    for (const scenario of SCENARIOS) {
      const interactive = scenario.steps.filter((step) => step.kind !== 'info')
      expect(interactive.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('reuses phrasebook wording where the same line exists', () => {
    // Sanity check that scenario Russian is written the same way as the
    // phrasebook, so progress is shared rather than fragmented.
    const phraseTexts = new Set(PHRASES.map((p) => normalizeRussian(p.russian)))
    const shared = SCENARIOS.flatMap((s) => s.steps)
      .map((step) => step.targetRussian)
      .filter((text): text is string => Boolean(text))
      .filter((text) => phraseTexts.has(normalizeRussian(text)))
    expect(shared.length).toBeGreaterThanOrEqual(10)
  })
})
