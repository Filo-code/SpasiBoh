import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/database'
import { createItemProgress, putItem } from '@/db/progressRepo'
import { applyAnswer } from './mastery'
import {
  buildAlphabetTraining,
  buildMistakesTraining,
  buildPhraseTraining,
  buildReviewExercises,
  buildSessionPlan,
  buildWordTraining,
  collectWeakItems,
  countDue,
  STAGE_ORDER,
} from './session'
import { createRng } from '@/utils/random'
import { itemKey } from '@/types/progress'
import { DAY } from '@/utils/time'

const PLAN_OPTIONS = {
  allowSpeech: true,
  wordsPerSession: 16,
  warmupTarget: 20,
  warmupMinutes: 10,
}

beforeEach(async () => {
  await Promise.all([db.items.clear(), db.sessions.clear(), db.days.clear(), db.stats.clear()])
})

describe('buildSessionPlan', () => {
  it('produces every stage a session needs', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 1 })

    expect(plan.warmupQueue.length).toBeGreaterThanOrEqual(40)
    expect(plan.words).toHaveLength(16)
    expect(plan.listening).toHaveLength(8)
    expect(plan.sentences).toHaveLength(8)
    expect(plan.scenario.steps.length).toBeGreaterThan(0)
  })

  it('covers the documented stage order', () => {
    expect(STAGE_ORDER).toEqual([
      'warmup',
      'words',
      'listening',
      'sentences',
      'travel',
      'review',
    ])
  })

  it('makes every listening exercise audio-driven', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 2 })
    for (const exercise of plan.listening) {
      expect(exercise.audioIsPrompt).toBe(true)
      expect(exercise.audioText).toBeTruthy()
    }
  })

  it('never repeats the same item inside a stage', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 3 })
    const wordKeys = plan.words.map((exercise) => exercise.itemKey)
    expect(new Set(wordKeys).size).toBe(wordKeys.length)

    const sentenceKeys = plan.sentences.map((exercise) => exercise.itemKey)
    expect(new Set(sentenceKeys).size).toBe(sentenceKeys.length)
  })

  it('does not reuse a listening word in the vocabulary stage', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 4 })
    const wordKeys = new Set(plan.words.map((e) => e.itemKey))
    const listeningWordKeys = plan.listening
      .filter((e) => e.itemKind === 'word')
      .map((e) => e.itemKey)
    for (const key of listeningWordKeys) {
      expect(wordKeys.has(key)).toBe(false)
    }
  })

  it('is reproducible for a fixed seed and varies with it', async () => {
    const a = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 7 })
    const b = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 7 })
    const c = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 8 })

    expect(a.words.map((e) => e.itemId)).toEqual(b.words.map((e) => e.itemId))
    expect(a.warmupQueue).toEqual(b.warmupQueue)
    expect(c.warmupQueue).not.toEqual(a.warmupQueue)
  })

  it('excludes speech exercises when speech is unavailable', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, allowSpeech: false, seed: 9 })
    for (const exercise of [...plan.words, ...plan.sentences]) {
      expect(exercise.answerMode).not.toBe('speech')
    }
  })

  it('reports the brand-new items it is about to introduce', async () => {
    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 10 })
    expect(plan.newItemKeys.length).toBeGreaterThan(0)
    expect(new Set(plan.newItemKeys).size).toBe(plan.newItemKeys.length)
  })

  it('prefers due material once there is history', async () => {
    // Make a handful of words overdue.
    const overdueIds = ['privet', 'spasibo', 'gde', 'voda', 'khleb', 'vokzal']
    await Promise.all(
      overdueIds.map((id) => {
        const progress = applyAnswer(createItemProgress('word', id), true, 'ru-it')
        return putItem({ ...progress, nextReviewAt: Date.now() - 10 * DAY })
      }),
    )

    const plan = await buildSessionPlan({ ...PLAN_OPTIONS, seed: 11 })
    const chosen = new Set(plan.words.map((exercise) => exercise.itemId))
    const overdueChosen = overdueIds.filter((id) => chosen.has(id))
    expect(overdueChosen.length).toBeGreaterThanOrEqual(5)
  })
})

describe('free training builders', () => {
  it('restricts vocabulary training to the requested category', async () => {
    const exercises = await buildWordTraining({
      count: 8,
      allowSpeech: false,
      category: 'numeri',
      seed: 1,
    })
    expect(exercises.length).toBeGreaterThan(0)
    for (const exercise of exercises) {
      expect(exercise.itemKind).toBe('word')
    }
  })

  it('forces the requested phrase exercise type', async () => {
    const exercises = await buildPhraseTraining({
      count: 6,
      allowSpeech: false,
      forceType: 'phrase-build',
      seed: 2,
    })
    for (const exercise of exercises) {
      expect(exercise.type).toBe('phrase-build')
      expect(exercise.solutionBlocks!.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('builds an alphabet queue of the requested length', async () => {
    const queue = await buildAlphabetTraining({ count: 25, allowSpeech: false, seed: 3 })
    expect(queue).toHaveLength(25)
  })
})

async function seedWeak(ids: string[]) {
  await Promise.all(
    ids.map((id) => {
      let progress = createItemProgress('word', id)
      for (let i = 0; i < 4; i++) progress = applyAnswer(progress, false, 'ru-it')
      return putItem({ ...progress, nextReviewAt: Date.now() + 3 * DAY })
    }),
  )
}

describe('weak items and mistake training', () => {

  it('lists weak items worst-first', async () => {
    await seedWeak(['seychas', 'dozhd', 'vokzal'])
    const items = await db.items.toArray()
    const weak = collectWeakItems(items)

    expect(weak.length).toBe(3)
    for (let i = 1; i < weak.length; i++) {
      expect(weak[i].progress.mastery).toBeGreaterThanOrEqual(weak[i - 1].progress.mastery)
    }
  })

  it('ignores progress rows whose content no longer exists', async () => {
    let ghost = createItemProgress('word', 'parola-che-non-esiste')
    for (let i = 0; i < 4; i++) ghost = applyAnswer(ghost, false, 'ru-it')
    await putItem(ghost)

    const weak = collectWeakItems(await db.items.toArray())
    expect(weak).toHaveLength(0)
  })

  it('builds a drill made of the weak items', async () => {
    await seedWeak(['seychas', 'dozhd', 'vokzal', 'khleb', 'voda'])
    const { exercises } = await buildMistakesTraining({ count: 10, allowSpeech: false, seed: 4 })

    expect(exercises.length).toBeGreaterThan(0)
    const ids = new Set(exercises.map((exercise) => exercise.itemId))
    for (const id of ids) {
      expect(['seychas', 'dozhd', 'vokzal', 'khleb', 'voda']).toContain(id)
    }
  })

  it('returns nothing to drill when there are no mistakes', async () => {
    const { exercises, letterQueue } = await buildMistakesTraining({
      count: 10,
      allowSpeech: false,
      seed: 5,
    })
    expect(exercises).toHaveLength(0)
    expect(letterQueue).toHaveLength(0)
  })
})

describe('buildReviewExercises', () => {
  it('builds one exercise per distinct wrong item', () => {
    const keys = [
      itemKey('letter', 'zhe'),
      itemKey('word', 'vokzal'),
      itemKey('phrase', 'met-02'),
      itemKey('word', 'vokzal'),
    ]
    const exercises = buildReviewExercises(keys, new Map(), createRng(1), false)
    expect(exercises).toHaveLength(3)
  })

  it('silently skips keys that no longer resolve to content', () => {
    const exercises = buildReviewExercises(
      [itemKey('word', 'non-esiste'), itemKey('phrase', 'scn-fantasma')],
      new Map(),
      createRng(1),
      false,
    )
    expect(exercises).toHaveLength(0)
  })

  it('caps the review block so it stays short', () => {
    const keys = Array.from({ length: 40 }, (_, i) => itemKey('word', `w${i}`))
    keys.push(itemKey('word', 'vokzal'))
    const exercises = buildReviewExercises(keys, new Map(), createRng(1), false)
    expect(exercises.length).toBeLessThanOrEqual(10)
  })
})

describe('countDue', () => {
  it('counts only items that have been seen and are past due', () => {
    const now = Date.now()
    const unseen = createItemProgress('word', 'a', now)
    const due = { ...applyAnswer(createItemProgress('word', 'b'), true, 'ru-it'), nextReviewAt: now - DAY }
    const future = { ...applyAnswer(createItemProgress('word', 'c'), true, 'ru-it'), nextReviewAt: now + DAY }

    expect(countDue([unseen, due, future], now)).toBe(1)
  })
})
