import { db, DEFAULT_SETTINGS, DEFAULT_STATS } from './database'
import type {
  AppSettings,
  DayStat,
  GlobalStats,
  ItemKey,
  ItemKind,
  ItemProgress,
  SessionRecord,
} from '@/types/progress'
import { itemKey } from '@/types/progress'
import { localDateKey, daysBetween } from '@/utils/time'

/**
 * The only module allowed to touch Dexie directly (besides `backup.ts`).
 * Components and the engine go through these functions.
 */

export function createItemProgress(kind: ItemKind, id: string, now = Date.now()): ItemProgress {
  return {
    key: itemKey(kind, id),
    kind,
    id,
    seenCount: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    bestStreak: 0,
    mastery: 0,
    ease: 2.5,
    intervalDays: 0,
    box: 0,
    lastSeenAt: 0,
    nextReviewAt: now,
    firstSeenAt: now,
    recentExerciseTypes: [],
    perceivedDifficulty: 0.5,
  }
}

export async function getAllItems(): Promise<ItemProgress[]> {
  return db.items.toArray()
}

export async function getItemsByKind(kind: ItemKind): Promise<ItemProgress[]> {
  return db.items.where('kind').equals(kind).toArray()
}

export async function getItem(key: ItemKey): Promise<ItemProgress | undefined> {
  return db.items.get(key)
}

export async function putItems(items: ItemProgress[]): Promise<void> {
  if (items.length === 0) return
  await db.items.bulkPut(items)
}

export async function putItem(item: ItemProgress): Promise<void> {
  await db.items.put(item)
}

// --------------------------------------------------------------- settings

export async function getSettings(): Promise<AppSettings> {
  const stored = await db.settings.get('settings')
  if (stored) return { ...DEFAULT_SETTINGS, ...stored }
  const fresh = { ...DEFAULT_SETTINGS, createdAt: Date.now() }
  await db.settings.put(fresh)
  return fresh
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const next = { ...current, ...patch, id: 'settings' as const }
  await db.settings.put(next)
  return next
}

// ------------------------------------------------------------------ stats

export async function getStats(): Promise<GlobalStats> {
  const stored = await db.stats.get('global')
  if (stored) return { ...DEFAULT_STATS, ...stored }
  await db.stats.put(DEFAULT_STATS)
  return { ...DEFAULT_STATS }
}

export async function saveStats(patch: Partial<GlobalStats>): Promise<GlobalStats> {
  const current = await getStats()
  const next = { ...current, ...patch, id: 'global' as const }
  await db.stats.put(next)
  return next
}

/**
 * Records study activity for "today" and keeps the streak up to date.
 * Called after every answered exercise (cheap: two small puts).
 */
export async function recordActivity(input: {
  elapsedMs: number
  correct: boolean
  isNewItem: boolean
  now?: number
}): Promise<void> {
  const now = input.now ?? Date.now()
  const dateKey = localDateKey(now)

  const day = (await db.days.get(dateKey)) ?? {
    date: dateKey,
    studiedMs: 0,
    exercises: 0,
    correct: 0,
    sessions: 0,
    newItems: 0,
  }
  day.studiedMs += input.elapsedMs
  day.exercises += 1
  if (input.correct) day.correct += 1
  if (input.isNewItem) day.newItems += 1
  await db.days.put(day)

  const stats = await getStats()
  stats.totalStudiedMs += input.elapsedMs
  stats.totalExercises += 1
  if (input.correct) stats.totalCorrect += 1

  if (stats.lastStudyDate !== dateKey) {
    const gap = stats.lastStudyDate ? daysBetween(stats.lastStudyDate, dateKey) : Infinity
    stats.currentStreak = gap === 1 ? stats.currentStreak + 1 : 1
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak)
    stats.lastStudyDate = dateKey
    stats.studyDays += 1
  }

  await db.stats.put(stats)
}

// --------------------------------------------------------------- sessions

export async function saveSession(session: SessionRecord): Promise<number> {
  const id = await db.sessions.add(session)
  const dateKey = localDateKey(session.startedAt)
  const day = await db.days.get(dateKey)
  if (day) {
    day.sessions += 1
    await db.days.put(day)
  }
  const stats = await getStats()
  await db.stats.put({ ...stats, totalSessions: stats.totalSessions + 1 })
  return id as number
}

export async function getRecentSessions(limit = 30): Promise<SessionRecord[]> {
  return db.sessions.orderBy('startedAt').reverse().limit(limit).toArray()
}

export async function getLastSession(): Promise<SessionRecord | undefined> {
  const list = await db.sessions.orderBy('startedAt').reverse().limit(1).toArray()
  return list[0]
}

// ------------------------------------------------------------------- days

export async function getDays(limit = 120): Promise<DayStat[]> {
  // Dexie returns newest-first; the chart wants oldest-first.
  const all = await db.days.orderBy('date').reverse().limit(limit).toArray()
  return all.toReversed()
}

export async function getToday(): Promise<DayStat | undefined> {
  return db.days.get(localDateKey())
}

// ------------------------------------------------------------------ reset

export async function resetAllProgress(): Promise<void> {
  await db.transaction('rw', db.items, db.sessions, db.days, db.settings, db.stats, async () => {
    await Promise.all([
      db.items.clear(),
      db.sessions.clear(),
      db.days.clear(),
      db.stats.clear(),
    ])
    // Settings are preferences, not progress — keep them but reset the timestamp.
    const settings = await db.settings.get('settings')
    if (settings) await db.settings.put({ ...settings, createdAt: Date.now() })
  })
}
