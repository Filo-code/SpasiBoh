import { describe, expect, it } from 'vitest'
import {
  buildLetterQueue,
  classify,
  selectItems,
  toProgressMap,
  weightForLetter,
  MISTAKES_MIX,
} from './scheduler'
import { applyAnswer } from './mastery'
import { createItemProgress } from '@/db/progressRepo'
import { itemKey, type ItemProgress } from '@/types/progress'
import { createRng } from '@/utils/random'
import { DAY } from '@/utils/time'

const NOW = 1_700_000_000_000

function pool(size: number) {
  return Array.from({ length: size }, (_, i) => ({ id: `w${i}`, order: i }))
}

function seen(id: string, opts: { correct: number; wrong?: number }): ItemProgress {
  let progress = createItemProgress('word', id, NOW - 30 * DAY)
  for (let i = 0; i < (opts.wrong ?? 0); i++) {
    progress = applyAnswer(progress, false, 'ru-it', NOW - 20 * DAY)
  }
  for (let i = 0; i < opts.correct; i++) {
    progress = applyAnswer(progress, true, 'ru-it', NOW - 20 * DAY)
  }
  return progress
}

describe('classify', () => {
  it('treats an item with no record as new', () => {
    expect(classify(undefined, NOW)).toBe('new')
    expect(classify(createItemProgress('word', 'x', NOW), NOW)).toBe('new')
  })

  it('treats an item past its review date as due', () => {
    const progress = { ...seen('a', { correct: 2 }), nextReviewAt: NOW - DAY }
    expect(classify(progress, NOW)).toBe('due')
  })

  it('treats a failing item that is not due yet as weak', () => {
    const progress = {
      ...seen('a', { correct: 1, wrong: 3 }),
      nextReviewAt: NOW + 5 * DAY,
    }
    expect(classify(progress, NOW)).toBe('weak')
  })

  it('treats a solid item that is not due yet as mastered', () => {
    const progress = { ...seen('a', { correct: 12 }), nextReviewAt: NOW + 30 * DAY }
    expect(classify(progress, NOW)).toBe('mastered')
  })
})

const rng = () => createRng(42)

describe('selectItems', () => {

  it('returns exactly the requested count when the pool is large enough', () => {
    const picked = selectItems('word', pool(100), new Map(), rng(), { count: 12, now: NOW })
    expect(picked).toHaveLength(12)
  })

  it('never returns the same item twice', () => {
    const picked = selectItems('word', pool(100), new Map(), rng(), { count: 20, now: NOW })
    expect(new Set(picked.map((p) => p.item.id)).size).toBe(20)
  })

  it('falls back to new items when there is no history at all', () => {
    const picked = selectItems('word', pool(50), new Map(), rng(), { count: 10, now: NOW })
    expect(picked.every((entry) => entry.bucket === 'new')).toBe(true)
  })

  it('respects the requested mix when every bucket is populated', () => {
    const progress = new Map<string, ItemProgress>()
    // 20 due, 20 weak, 20 mastered — the rest are new.
    for (let i = 0; i < 20; i++) {
      progress.set(itemKey('word', `w${i}`), {
        ...seen(`w${i}`, { correct: 3 }),
        nextReviewAt: NOW - 2 * DAY,
      })
    }
    for (let i = 20; i < 40; i++) {
      progress.set(itemKey('word', `w${i}`), {
        ...seen(`w${i}`, { correct: 1, wrong: 4 }),
        nextReviewAt: NOW + 3 * DAY,
      })
    }
    for (let i = 40; i < 60; i++) {
      progress.set(itemKey('word', `w${i}`), {
        ...seen(`w${i}`, { correct: 14 }),
        nextReviewAt: NOW + 60 * DAY,
      })
    }

    const picked = selectItems('word', pool(100), progress, rng(), { count: 20, now: NOW })
    const counts = picked.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.bucket] = (acc[entry.bucket] ?? 0) + 1
      return acc
    }, {})

    expect(counts.due).toBe(10) // 50%
    expect(counts.weak).toBe(5) // 25%
    expect(counts.new).toBe(4) // 20%
    expect(counts.mastered).toBe(1) // 5%
  })

  it('prioritises weak material under the mistakes mix', () => {
    const progress = new Map<string, ItemProgress>()
    for (let i = 0; i < 30; i++) {
      progress.set(itemKey('word', `w${i}`), {
        ...seen(`w${i}`, { correct: 1, wrong: 5 }),
        nextReviewAt: NOW + 3 * DAY,
      })
    }
    const picked = selectItems('word', pool(60), progress, rng(), {
      count: 10,
      now: NOW,
      mix: MISTAKES_MIX,
    })
    const weak = picked.filter((entry) => entry.bucket === 'weak').length
    expect(weak).toBeGreaterThanOrEqual(7)
  })

  it('sorts due items by how overdue they are', () => {
    const progress = new Map<string, ItemProgress>()
    progress.set(itemKey('word', 'w0'), { ...seen('w0', { correct: 2 }), nextReviewAt: NOW - DAY })
    progress.set(itemKey('word', 'w1'), {
      ...seen('w1', { correct: 2 }),
      nextReviewAt: NOW - 40 * DAY,
    })
    const picked = selectItems('word', pool(2), progress, rng(), { count: 2, now: NOW })
    expect(picked[0].item.id).toBe('w1')
  })

  it('honours the exclude set', () => {
    const picked = selectItems('word', pool(10), new Map(), rng(), {
      count: 5,
      now: NOW,
      exclude: new Set(['w0', 'w1', 'w2']),
    })
    expect(picked.map((p) => p.item.id)).not.toContain('w0')
    expect(picked.map((p) => p.item.id)).not.toContain('w1')
  })

  it('honours a category filter', () => {
    const picked = selectItems('word', pool(20), new Map(), rng(), {
      count: 5,
      now: NOW,
      filter: (item) => item.order % 2 === 0,
    })
    expect(picked.every((entry) => entry.item.order % 2 === 0)).toBe(true)
  })

  it('returns fewer items than requested rather than repeating', () => {
    const picked = selectItems('word', pool(3), new Map(), rng(), { count: 10, now: NOW })
    expect(picked).toHaveLength(3)
  })
})

describe('letter weighting', () => {
  it('weights an unseen letter above a mastered one', () => {
    const mastered = { ...seen('a', { correct: 12 }), nextReviewAt: NOW + 60 * DAY }
    expect(weightForLetter(undefined, NOW)).toBeGreaterThan(weightForLetter(mastered, NOW))
  })

  it('weights a weak letter above everything else', () => {
    const weak = { ...seen('a', { correct: 1, wrong: 6 }), nextReviewAt: NOW + 3 * DAY }
    const mastered = { ...seen('b', { correct: 12 }), nextReviewAt: NOW + 60 * DAY }
    expect(weightForLetter(weak, NOW)).toBeGreaterThan(weightForLetter(undefined, NOW))
    expect(weightForLetter(weak, NOW)).toBeGreaterThan(weightForLetter(mastered, NOW))
  })
})

describe('buildLetterQueue', () => {
  const letters = ['a', 'be', 've', 'ge', 'de', 'ye', 'zhe', 'ze']

  it('produces exactly the requested length', () => {
    const queue = buildLetterQueue(letters, new Map(), createRng(1), 30, NOW)
    expect(queue).toHaveLength(30)
  })

  it('never repeats a letter twice in a row', () => {
    const queue = buildLetterQueue(letters, new Map(), createRng(7), 60, NOW)
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i]).not.toBe(queue[i - 1])
    }
  })

  it('shows weak letters more often than mastered ones', () => {
    const progressMap = toProgressMap([
      { ...seen('zhe', { correct: 1, wrong: 8 }), key: itemKey('letter', 'zhe'), kind: 'letter', id: 'zhe', nextReviewAt: NOW + 3 * DAY },
      { ...seen('a', { correct: 14 }), key: itemKey('letter', 'a'), kind: 'letter', id: 'a', nextReviewAt: NOW + 90 * DAY },
    ])

    const queue = buildLetterQueue(letters, progressMap, createRng(3), 400, NOW)
    const weakCount = queue.filter((id) => id === 'zhe').length
    const masteredCount = queue.filter((id) => id === 'a').length
    expect(weakCount).toBeGreaterThan(masteredCount * 3)
  })

  it('is deterministic for a given seed', () => {
    const a = buildLetterQueue(letters, new Map(), createRng(99), 40, NOW)
    const b = buildLetterQueue(letters, new Map(), createRng(99), 40, NOW)
    expect(a).toEqual(b)
  })

  it('copes with a single-letter pool', () => {
    const queue = buildLetterQueue(['a'], new Map(), createRng(1), 5, NOW)
    expect(queue).toEqual(['a', 'a', 'a', 'a', 'a'])
  })
})
