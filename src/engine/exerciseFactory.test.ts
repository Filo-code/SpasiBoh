import { describe, expect, it } from 'vitest'
import {
  buildLetterExercise,
  buildPhraseExercise,
  buildWordExercise,
  chooseExerciseType,
  REPLYABLE_PHRASE_IDS,
} from './exerciseFactory'
import { applyAnswer } from './mastery'
import { createItemProgress } from '@/db/progressRepo'
import { createRng } from '@/utils/random'
import { ALPHABET_BY_ID } from '@/data/alphabet'
import { WORDS, WORDS_BY_ID } from '@/data/words'
import { PHRASES_BY_ID, PHRASES } from '@/data/phrases'
import { WORD_EXERCISES } from '@/types/exercise'
import { normalizeRussian } from '@/utils/text'

const NOW = 1_700_000_000_000
const OPTIONS = { allowSpeech: true }

function progressFor(id: string, correct = 0) {
  let progress = createItemProgress('word', id, NOW)
  for (let i = 0; i < correct; i++) progress = applyAnswer(progress, true, 'ru-it', NOW)
  return progress
}

describe('chooseExerciseType', () => {
  it('never picks a speech exercise when speech is unavailable', () => {
    const progress = progressFor('vokzal', 5)
    for (let seed = 0; seed < 60; seed++) {
      const type = chooseExerciseType(WORD_EXERCISES, progress, createRng(seed), {
        allowSpeech: false,
      })
      expect(type).not.toBe('word-pronounce')
    }
  })

  it('honours a forced type', () => {
    const type = chooseExerciseType(WORD_EXERCISES, progressFor('vokzal'), createRng(1), {
      ...OPTIONS,
      forceType: 'audio-it',
    })
    expect(type).toBe('audio-it')
  })

  it('avoids the two most recent formats', () => {
    const progress = {
      ...progressFor('vokzal', 3),
      recentExerciseTypes: ['ru-it', 'audio-it', 'it-ru'],
    }
    for (let seed = 0; seed < 60; seed++) {
      const type = chooseExerciseType(WORD_EXERCISES, progress, createRng(seed), OPTIONS)
      expect(type).not.toBe('ru-it')
      expect(type).not.toBe('audio-it')
    }
  })

  it('leans on recognition for brand-new items', () => {
    const counts: Record<string, number> = {}
    for (let seed = 0; seed < 300; seed++) {
      const type = chooseExerciseType(WORD_EXERCISES, progressFor('vokzal'), createRng(seed), OPTIONS)
      counts[type] = (counts[type] ?? 0) + 1
    }
    expect(counts['ru-it'] ?? 0).toBeGreaterThan(counts['word-pronounce'] ?? 0)
  })
})

describe('buildWordExercise', () => {
  const word = WORDS_BY_ID.vokzal

  it('always produces exactly one correct option in choice mode', () => {
    for (let seed = 0; seed < 40; seed++) {
      const exercise = buildWordExercise(word, progressFor(word.id, 2), createRng(seed), OPTIONS)
      if (exercise.answerMode !== 'choice') continue
      const correct = exercise.options!.filter((option) => option.correct)
      expect(correct).toHaveLength(1)
      expect(exercise.options).toHaveLength(4)
    }
  })

  it('never repeats an option label', () => {
    for (let seed = 0; seed < 40; seed++) {
      const exercise = buildWordExercise(word, progressFor(word.id, 2), createRng(seed), OPTIONS)
      if (!exercise.options) continue
      const labels = exercise.options.map((option) => option.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('does not always place the answer in the same slot', () => {
    const positions = new Set<number>()
    for (let seed = 0; seed < 40; seed++) {
      const exercise = buildWordExercise(word, progressFor(word.id, 2), createRng(seed), {
        ...OPTIONS,
        forceType: 'ru-it',
      })
      positions.add(exercise.options!.findIndex((option) => option.correct))
    }
    expect(positions.size).toBeGreaterThan(1)
  })

  it('keeps the answer out of the prompt', () => {
    const exercise = buildWordExercise(word, progressFor(word.id), createRng(5), {
      ...OPTIONS,
      forceType: 'ru-it',
    })
    expect(exercise.promptMain).toBe(word.russian)
    expect(exercise.promptSub).toBeUndefined()
    // The translation and transliteration only live in `reveal`.
    expect(exercise.reveal.italian).toBe(word.italian)
    expect(exercise.reveal.transliteration).toBe(word.transliteration)
  })

  it('does not show any text for a pure audio prompt', () => {
    const exercise = buildWordExercise(word, progressFor(word.id, 3), createRng(2), {
      ...OPTIONS,
      forceType: 'audio-it',
    })
    expect(exercise.audioIsPrompt).toBe(true)
    expect(exercise.audioText).toBe(word.russian)
    expect(exercise.promptMain).toBeUndefined()
  })

  it('builds a spelling exercise whose blocks reconstruct the word', () => {
    const exercise = buildWordExercise(word, progressFor(word.id, 4), createRng(11), {
      ...OPTIONS,
      forceType: 'word-spell',
    })
    expect(exercise.solutionBlocks!.join('')).toBe(word.russian)
    for (const letter of exercise.solutionBlocks!) {
      expect(exercise.blocks).toContain(letter)
    }
    expect(exercise.blocks!.length).toBeGreaterThan(exercise.solutionBlocks!.length)
  })

  it('only offers a visual exercise for words that have an emoji', () => {
    const noEmoji = WORDS.find((w) => !w.visualHint)!
    for (let seed = 0; seed < 30; seed++) {
      const exercise = buildWordExercise(noEmoji, progressFor(noEmoji.id, 3), createRng(seed), OPTIONS)
      expect(exercise.type).not.toBe('visual-ru')
    }
  })

  it('marks a never-seen word as new', () => {
    const exercise = buildWordExercise(word, progressFor(word.id, 0), createRng(1), OPTIONS)
    expect(exercise.isNew).toBe(true)
  })

  it('produces a distinct uid per instance', () => {
    const a = buildWordExercise(word, progressFor(word.id), createRng(1), OPTIONS)
    const b = buildWordExercise(word, progressFor(word.id), createRng(1), OPTIONS)
    expect(a.uid).not.toBe(b.uid)
  })

  it('covers every word in the dataset without throwing', () => {
    for (const [index, entry] of WORDS.entries()) {
      const exercise = buildWordExercise(entry, progressFor(entry.id, 3), createRng(index), OPTIONS)
      expect(exercise.reveal.russian).toBe(entry.russian)
      expect(exercise.itemId).toBe(entry.id)
      if (exercise.options) expect(exercise.options.filter((o) => o.correct)).toHaveLength(1)
    }
  })
})

describe('buildPhraseExercise', () => {
  const phrase = PHRASES_BY_ID['met-02']

  it('builds a sentence whose blocks contain the whole solution', () => {
    const exercise = buildPhraseExercise(phrase, progressFor(phrase.id, 2), createRng(3), {
      ...OPTIONS,
      forceType: 'phrase-build',
    })
    expect(exercise.solutionBlocks!.join(' ')).toBe(phrase.russian)
    for (const block of exercise.solutionBlocks!) {
      expect(exercise.blocks).toContain(block)
    }
    expect(exercise.blocks!.length).toBeGreaterThan(exercise.solutionBlocks!.length)
  })

  it('blanks exactly one word in a gap exercise, and offers it as an option', () => {
    const exercise = buildPhraseExercise(phrase, progressFor(phrase.id, 2), createRng(9), {
      ...OPTIONS,
      forceType: 'phrase-gap',
    })
    expect(exercise.promptMain).toContain('____')
    expect(exercise.promptMain!.match(/____/g)).toHaveLength(1)
    const correct = exercise.options!.find((option) => option.correct)!
    expect(normalizeRussian(exercise.promptMain!.replace('____', correct.label))).toBe(
      normalizeRussian(phrase.russian),
    )
  })

  it('only generates a reply exercise for questions with a written answer', () => {
    const replyable = new Set(REPLYABLE_PHRASE_IDS)
    for (const entry of PHRASES) {
      for (let seed = 0; seed < 8; seed++) {
        const exercise = buildPhraseExercise(entry, progressFor(entry.id, 4), createRng(seed), OPTIONS)
        if (exercise.type === 'phrase-reply') {
          expect(replyable.has(entry.id)).toBe(true)
        }
      }
    }
  })

  it('covers every phrase in the dataset without throwing', () => {
    for (const [index, entry] of PHRASES.entries()) {
      const exercise = buildPhraseExercise(entry, progressFor(entry.id, 2), createRng(index), OPTIONS)
      expect(exercise.itemId).toBe(entry.id)
      if (exercise.options) {
        expect(exercise.options.filter((o) => o.correct)).toHaveLength(1)
        expect(new Set(exercise.options.map((o) => o.label)).size).toBe(exercise.options.length)
      }
    }
  })
})

describe('buildLetterExercise', () => {
  const letter = ALPHABET_BY_ID.zhe

  it('asks for the sound without revealing it', () => {
    const exercise = buildLetterExercise(letter, progressFor(letter.id), createRng(1), {
      ...OPTIONS,
      forceType: 'letter-sound',
    })
    expect(exercise.prompt).toBe('Come si pronuncia?')
    expect(exercise.promptMain).toBe('Ж')
    expect(exercise.promptSub).toBeUndefined()
    expect(exercise.reveal.transliteration).toContain('zh')
  })

  it('uses confusable letters as distractors', () => {
    const exercise = buildLetterExercise(letter, progressFor(letter.id), createRng(1), {
      ...OPTIONS,
      forceType: 'letter-sound',
    })
    const labels = exercise.options!.map((option) => option.label)
    const confusableSounds = new Set(letter.confusableWith.map((id) => ALPHABET_BY_ID[id].soundKey))
    expect(labels.some((label) => confusableSounds.has(label))).toBe(true)
  })

  it('never offers two options with the same sound', () => {
    for (const entry of Object.values(ALPHABET_BY_ID)) {
      for (let seed = 0; seed < 5; seed++) {
        const exercise = buildLetterExercise(entry, progressFor(entry.id), createRng(seed), {
          ...OPTIONS,
          forceType: 'letter-sound',
        })
        const labels = exercise.options!.map((option) => option.label)
        expect(new Set(labels).size).toBe(labels.length)
      }
    }
  })
})
