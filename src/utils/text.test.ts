import { describe, expect, it } from 'vitest'
import {
  blocksMatch,
  levenshtein,
  matchSpeech,
  normalizeItalian,
  normalizeRussian,
  similarity,
  stripStressMarks,
  toBlocks,
} from './text'

describe('normalizeRussian', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeRussian('Где вокзал?')).toBe('где вокзал')
    expect(normalizeRussian('  Привет!  ')).toBe('привет')
  })

  it('treats ё and е as the same letter', () => {
    expect(normalizeRussian('ещё')).toBe(normalizeRussian('еще'))
    expect(normalizeRussian('Счёт')).toBe('счет')
  })

  it('removes combining stress marks', () => {
    expect(normalizeRussian('вокза́л')).toBe('вокзал')
    expect(stripStressMarks('спаси́бо')).toBe('спасибо')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeRussian('Как   тебя  зовут ?')).toBe('как тебя зовут')
  })

  it('handles guillemets and dashes used in the dataset', () => {
    expect(normalizeRussian('«Следующая станция — Арбатская»')).toBe(
      'следующая станция арбатская',
    )
  })
})

describe('normalizeItalian', () => {
  it('strips accents and punctuation', () => {
    expect(normalizeItalian("Dov'è la stazione?")).toBe('dov e la stazione')
    expect(normalizeItalian('perché')).toBe('perche')
  })
})

describe('levenshtein / similarity', () => {
  it('returns 0 distance for identical strings', () => {
    expect(levenshtein('вокзал', 'вокзал')).toBe(0)
    expect(similarity('вокзал', 'вокзал')).toBe(1)
  })

  it('counts single edits', () => {
    expect(levenshtein('кот', 'кит')).toBe(1)
    expect(levenshtein('кот', 'кота')).toBe(1)
  })

  it('handles empty input', () => {
    expect(levenshtein('', 'кот')).toBe(3)
    expect(similarity('', '')).toBe(1)
  })
})

describe('matchSpeech', () => {
  it('accepts an exact transcript', () => {
    const result = matchSpeech(['вокзал'], 'вокзал')
    expect(result.matched).toBe(true)
    expect(result.score).toBe(1)
    expect(result.best).toBe('вокзал')
  })

  it('ignores case, punctuation and ё spelling', () => {
    expect(matchSpeech(['Где Вокзал?'], 'где вокзал').matched).toBe(true)
    expect(matchSpeech(['счет пожалуйста'], 'Счёт, пожалуйста.').matched).toBe(true)
  })

  it('picks the best of several alternatives', () => {
    const result = matchSpeech(['вот зал', 'вокзал', 'вок зал'], 'вокзал')
    expect(result.matched).toBe(true)
    expect(result.best).toBe('вокзал')
  })

  it('rejects a genuinely different short word', () => {
    // Short targets are held to a strict threshold: кот vs кит is a real error.
    expect(matchSpeech(['кит'], 'кот').matched).toBe(false)
  })

  it('tolerates a small slip in a long phrase', () => {
    const result = matchSpeech(
      ['где ближайшая станция метро'],
      'Где ближайшая станция метро?',
    )
    expect(result.matched).toBe(true)
  })

  it('rejects an unrelated phrase of similar length', () => {
    expect(matchSpeech(['я хочу пить воду'], 'Где ближайшая станция метро?').matched).toBe(false)
  })

  it('returns no match for empty transcripts', () => {
    const result = matchSpeech([], 'вокзал')
    expect(result.matched).toBe(false)
    expect(result.score).toBe(0)
  })

  it('accepts alternative phrasings passed explicitly', () => {
    const result = matchSpeech(['здравствуй'], 'Здравствуйте', ['Здравствуй'])
    expect(result.matched).toBe(true)
  })
})

describe('sentence blocks', () => {
  it('splits and rejoins losslessly', () => {
    expect(toBlocks('Я живу в Италии.')).toEqual(['Я', 'живу', 'в', 'Италии.'])
  })

  it('matches the assembled sentence ignoring punctuation', () => {
    expect(blocksMatch(['Я', 'живу', 'в', 'Италии.'], 'Я живу в Италии.')).toBe(true)
    expect(blocksMatch(['Я', 'живу', 'в', 'Италии'], 'Я живу в Италии.')).toBe(true)
  })

  it('rejects the wrong word order', () => {
    expect(blocksMatch(['живу', 'Я', 'в', 'Италии.'], 'Я живу в Италии.')).toBe(false)
  })

  it('rejects an extra block', () => {
    expect(blocksMatch(['Я', 'живу', 'в', 'Италии.', 'собака'], 'Я живу в Италии.')).toBe(false)
  })
})
