import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './database'
import {
  createItemProgress,
  getAllItems,
  getItem,
  getSettings,
  getStats,
  getToday,
  putItem,
  recordActivity,
  resetAllProgress,
  saveSession,
  saveSettings,
} from './progressRepo'
import { exportProgress, importProgress, validateBackup, backupFileName } from './backup'
import { applyAnswer } from '@/engine/mastery'
import { localDateKey, DAY } from '@/utils/time'
import type { BackupFile, SessionRecord } from '@/types/progress'

async function wipe() {
  await Promise.all([
    db.items.clear(),
    db.sessions.clear(),
    db.days.clear(),
    db.settings.clear(),
    db.stats.clear(),
  ])
}

beforeEach(async () => {
  await wipe()
})

describe('item persistence', () => {
  it('round-trips a progress record', async () => {
    const progress = applyAnswer(createItemProgress('word', 'vokzal'), true, 'ru-it')
    await putItem(progress)

    const loaded = await getItem('word:vokzal')
    expect(loaded).toBeDefined()
    expect(loaded!.seenCount).toBe(1)
    expect(loaded!.correctCount).toBe(1)
    expect(loaded!.mastery).toBeCloseTo(progress.mastery)
  })

  it('overwrites rather than duplicating on the same key', async () => {
    let progress = applyAnswer(createItemProgress('word', 'vokzal'), true, 'ru-it')
    await putItem(progress)
    progress = applyAnswer(progress, true, 'audio-it')
    await putItem(progress)

    const all = await getAllItems()
    expect(all).toHaveLength(1)
    expect(all[0].seenCount).toBe(2)
  })

  it('survives a simulated app restart', async () => {
    await putItem(applyAnswer(createItemProgress('letter', 'zhe'), false, 'letter-sound'))
    await db.close()
    await db.open()

    const loaded = await getItem('letter:zhe')
    expect(loaded!.wrongCount).toBe(1)
  })
})

describe('daily activity and streak', () => {
  it('accumulates today\'s minutes and exercise count', async () => {
    await recordActivity({ elapsedMs: 4000, correct: true, isNewItem: true })
    await recordActivity({ elapsedMs: 6000, correct: false, isNewItem: false })

    const today = await getToday()
    expect(today!.studiedMs).toBe(10_000)
    expect(today!.exercises).toBe(2)
    expect(today!.correct).toBe(1)
    expect(today!.newItems).toBe(1)
    expect(today!.date).toBe(localDateKey())
  })

  it('starts the streak at 1 on the first day', async () => {
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })
    const stats = await getStats()
    expect(stats.currentStreak).toBe(1)
    expect(stats.studyDays).toBe(1)
  })

  it('does not inflate the streak twice in the same day', async () => {
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })
    const stats = await getStats()
    expect(stats.currentStreak).toBe(1)
    expect(stats.totalExercises).toBe(2)
  })

  it('extends the streak on a consecutive day', async () => {
    const yesterday = Date.now() - DAY
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false, now: yesterday })
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })

    const stats = await getStats()
    expect(stats.currentStreak).toBe(2)
    expect(stats.bestStreak).toBe(2)
  })

  it('resets the streak after a gap, keeping the record', async () => {
    const longAgo = Date.now() - 5 * DAY
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false, now: longAgo - DAY })
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false, now: longAgo })
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })

    const stats = await getStats()
    expect(stats.currentStreak).toBe(1)
    expect(stats.bestStreak).toBe(2)
  })
})

describe('sessions', () => {
  const session: SessionRecord = {
    startedAt: Date.now() - 60_000,
    endedAt: Date.now(),
    durationMs: 60_000,
    activeMs: 50_000,
    correct: 8,
    total: 10,
    newItems: 3,
    stages: [{ stage: 'words', correct: 8, total: 10, durationMs: 50_000 }],
    weakKeys: ['word:vokzal'],
    completed: true,
    mode: 'daily',
  }

  it('stores a session and bumps the counter', async () => {
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: false })
    await saveSession(session)

    const stats = await getStats()
    expect(stats.totalSessions).toBe(1)
    expect(await db.sessions.count()).toBe(1)
  })
})

describe('settings', () => {
  it('creates defaults on first read', async () => {
    const settings = await getSettings()
    expect(settings.warmupTarget).toBe(20)
    expect(settings.id).toBe('settings')
  })

  it('persists a patch', async () => {
    await saveSettings({ warmupTarget: 30, voiceURI: 'ru-voice' })
    const settings = await getSettings()
    expect(settings.warmupTarget).toBe(30)
    expect(settings.voiceURI).toBe('ru-voice')
    // Untouched fields keep their defaults.
    expect(settings.wordsPerSession).toBe(16)
  })
})

describe('reset', () => {
  it('clears progress but keeps preferences', async () => {
    await saveSettings({ warmupTarget: 25 })
    await putItem(applyAnswer(createItemProgress('word', 'vokzal'), true, 'ru-it'))
    await recordActivity({ elapsedMs: 1000, correct: true, isNewItem: true })

    await resetAllProgress()

    expect(await getAllItems()).toHaveLength(0)
    expect(await getToday()).toBeUndefined()
    expect((await getStats()).totalExercises).toBe(0)
    expect((await getSettings()).warmupTarget).toBe(25)
  })
})

async function seedProgress() {
  await putItem(applyAnswer(createItemProgress('word', 'vokzal'), true, 'ru-it'))
  await putItem(applyAnswer(createItemProgress('letter', 'zhe'), false, 'letter-sound'))
  await recordActivity({ elapsedMs: 5000, correct: true, isNewItem: true })
}

describe('export / import', () => {

  it('exports everything that was stored', async () => {
    await seedProgress()
    const backup = await exportProgress()

    expect(backup.format).toBe('russo-trainer-backup')
    expect(backup.data.items).toHaveLength(2)
    expect(backup.data.days).toHaveLength(1)
    expect(backup.data.stats).not.toBeNull()
  })

  it('survives a full export → wipe → import cycle', async () => {
    await seedProgress()
    const backup = await exportProgress()

    await wipe()
    expect(await getAllItems()).toHaveLength(0)

    await importProgress(backup, 'replace')
    const restored = await getAllItems()
    expect(restored).toHaveLength(2)
    expect(restored.find((item) => item.key === 'word:vokzal')!.correctCount).toBe(1)
  })

  it('keeps the stronger record when merging', async () => {
    let strong = createItemProgress('word', 'vokzal')
    for (let i = 0; i < 5; i++) strong = applyAnswer(strong, true, 'ru-it')
    await putItem(strong)
    const backup = await exportProgress()

    await wipe()
    await putItem(applyAnswer(createItemProgress('word', 'vokzal'), true, 'ru-it'))

    await importProgress(backup, 'merge')
    const merged = await getItem('word:vokzal')
    expect(merged!.seenCount).toBe(5)
  })

  it('rejects a file that is not a backup', () => {
    expect(validateBackup(null).valid).toBe(false)
    expect(validateBackup({}).valid).toBe(false)
    expect(validateBackup({ format: 'something-else', version: 1, data: {} }).valid).toBe(false)
  })

  it('rejects a backup from a newer app version', () => {
    const result = validateBackup({
      format: 'russo-trainer-backup',
      version: 99,
      data: { items: [], sessions: [], days: [] },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects malformed item rows', () => {
    const result = validateBackup({
      format: 'russo-trainer-backup',
      version: 1,
      data: {
        items: [{ key: 'no-colon', kind: 'word', seenCount: 1, mastery: 0.5 }],
        sessions: [],
        days: [],
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('items[0]')
  })

  it('rejects a mastery value outside 0..1', () => {
    const result = validateBackup({
      format: 'russo-trainer-backup',
      version: 1,
      data: {
        items: [{ key: 'word:x', kind: 'word', seenCount: 1, mastery: 7 }],
        sessions: [],
        days: [],
      },
    })
    expect(result.valid).toBe(false)
  })

  it('never writes an invalid backup to the database', async () => {
    await seedProgress()
    const broken = {
      format: 'russo-trainer-backup',
      version: 1,
      data: { items: [{ key: 'bad' }], sessions: [], days: [] },
    } as unknown as BackupFile

    await expect(importProgress(broken, 'replace')).rejects.toThrow()
    expect(await getAllItems()).toHaveLength(2)
  })

  it('accepts a valid empty backup', () => {
    const result = validateBackup({
      format: 'russo-trainer-backup',
      version: 1,
      exportedAt: Date.now(),
      data: { items: [], sessions: [], days: [], settings: null, stats: null },
    })
    expect(result.valid).toBe(true)
    expect(result.summary!.items).toBe(0)
  })

  it('produces a dated filename', () => {
    expect(backupFileName(Date.parse('2026-08-17T10:00:00'))).toBe(
      'russo-progresso-2026-08-17.json',
    )
  })
})
