import { describe, expect, it } from 'vitest'
import {
  accuracyOf,
  applyAnswer,
  computeMastery,
  isMastered,
  isWeak,
  masteryLevel,
  MAX_EASE,
  MIN_EASE,
  overdueDays,
  RELEARN_DELAY_MS,
} from './mastery'
import { createItemProgress } from '@/db/progressRepo'
import { DAY } from '@/utils/time'

const NOW = 1_700_000_000_000

function fresh() {
  return createItemProgress('word', 'vokzal', NOW)
}

/** Answers correctly `times` in a row starting from a fresh item. */
function drill(times: number, correct = true) {
  let progress = fresh()
  let at = NOW
  for (let i = 0; i < times; i++) {
    progress = applyAnswer(progress, correct, 'ru-it', at)
    at += progress.intervalDays * DAY || RELEARN_DELAY_MS
  }
  return progress
}

describe('computeMastery', () => {
  it('is 0 for an item never seen', () => {
    expect(computeMastery(fresh())).toBe(0)
  })

  it('does not jump to mastered after one lucky answer', () => {
    const after = applyAnswer(fresh(), true, 'ru-it', NOW)
    expect(after.mastery).toBeLessThan(0.4)
  })

  it('grows monotonically with a correct streak', () => {
    const one = drill(1).mastery
    const three = drill(3).mastery
    const six = drill(6).mastery
    expect(three).toBeGreaterThan(one)
    expect(six).toBeGreaterThan(three)
  })

  it('stays within 0..1', () => {
    const long = drill(20)
    expect(long.mastery).toBeLessThanOrEqual(1)
    expect(long.mastery).toBeGreaterThanOrEqual(0)
  })

  it('drops after a mistake', () => {
    const strong = drill(6)
    const slipped = applyAnswer(strong, false, 'ru-it', NOW + 10 * DAY)
    expect(slipped.mastery).toBeLessThan(strong.mastery)
  })
})

describe('applyAnswer scheduling', () => {
  it('schedules the first correct answer one day out', () => {
    const after = applyAnswer(fresh(), true, 'ru-it', NOW)
    expect(after.intervalDays).toBe(1)
    expect(after.nextReviewAt).toBe(NOW + DAY)
    expect(after.box).toBe(1)
  })

  it('grows the interval multiplicatively after the second box', () => {
    const second = applyAnswer(applyAnswer(fresh(), true, 'ru-it', NOW), true, 'ru-it', NOW)
    expect(second.intervalDays).toBe(3)

    const third = applyAnswer(second, true, 'ru-it', NOW)
    expect(third.intervalDays).toBeGreaterThan(3)
  })

  it('caps the interval so nothing disappears forever', () => {
    const long = drill(25)
    expect(long.intervalDays).toBeLessThanOrEqual(180)
  })

  it('brings a wrong answer back inside the same session', () => {
    const strong = drill(4)
    const wrong = applyAnswer(strong, false, 'ru-it', NOW)
    expect(wrong.intervalDays).toBe(0)
    expect(wrong.nextReviewAt).toBe(NOW + RELEARN_DELAY_MS)
    expect(wrong.streak).toBe(0)
  })

  it('keeps ease inside its bounds', () => {
    const easy = drill(30)
    expect(easy.ease).toBeLessThanOrEqual(MAX_EASE)

    let hard = fresh()
    for (let i = 0; i < 20; i++) hard = applyAnswer(hard, false, 'ru-it', NOW)
    expect(hard.ease).toBeGreaterThanOrEqual(MIN_EASE)
  })

  it('counts exposures, hits and misses', () => {
    let progress = fresh()
    progress = applyAnswer(progress, true, 'ru-it', NOW)
    progress = applyAnswer(progress, false, 'ru-it', NOW)
    progress = applyAnswer(progress, true, 'ru-it', NOW)

    expect(progress.seenCount).toBe(3)
    expect(progress.correctCount).toBe(2)
    expect(progress.wrongCount).toBe(1)
    expect(progress.streak).toBe(1)
    expect(progress.bestStreak).toBe(1)
  })

  it('records the exercise type so formats can rotate', () => {
    let progress = applyAnswer(fresh(), true, 'ru-it', NOW)
    progress = applyAnswer(progress, true, 'audio-it', NOW)
    expect(progress.recentExerciseTypes.slice(0, 2)).toEqual(['audio-it', 'ru-it'])
    expect(progress.recentExerciseTypes.length).toBeLessThanOrEqual(4)
  })

  it('sets firstSeenAt only once', () => {
    const first = applyAnswer(fresh(), true, 'ru-it', NOW)
    const second = applyAnswer(first, true, 'ru-it', NOW + 5 * DAY)
    expect(second.firstSeenAt).toBe(first.firstSeenAt)
  })

  it('raises perceived difficulty on failure and lowers it on success', () => {
    const base = fresh()
    const failed = applyAnswer(base, false, 'ru-it', NOW)
    const passed = applyAnswer(base, true, 'ru-it', NOW)
    expect(failed.perceivedDifficulty).toBeGreaterThan(base.perceivedDifficulty)
    expect(passed.perceivedDifficulty).toBeLessThan(base.perceivedDifficulty)
  })
})

describe('classification helpers', () => {
  it('never marks an unseen item as weak', () => {
    expect(isWeak(fresh())).toBe(false)
  })

  it('marks a repeatedly failed item as weak', () => {
    let progress = fresh()
    for (let i = 0; i < 4; i++) progress = applyAnswer(progress, false, 'ru-it', NOW)
    expect(isWeak(progress)).toBe(true)
  })

  it('marks a long correct streak as mastered', () => {
    expect(isMastered(drill(10))).toBe(true)
  })

  it('does not mark a fresh success as mastered', () => {
    expect(isMastered(drill(1))).toBe(false)
  })

  it('reports accuracy only once seen', () => {
    expect(accuracyOf(fresh())).toBeNull()
    expect(accuracyOf({ seenCount: 4, correctCount: 3 })).toBeCloseTo(0.75)
  })

  it('labels mastery levels', () => {
    expect(masteryLevel(0, 0)).toBe('nuovo')
    expect(masteryLevel(0.1, 2)).toBe('debole')
    expect(masteryLevel(0.5, 5)).toBe('in-corso')
    expect(masteryLevel(0.7, 5)).toBe('buono')
    expect(masteryLevel(0.9, 9)).toBe('padroneggiato')
  })

  it('computes how overdue an item is', () => {
    const progress = { ...fresh(), nextReviewAt: NOW - 3 * DAY }
    expect(overdueDays(progress, NOW)).toBeCloseTo(3)
  })
})
