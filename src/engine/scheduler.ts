import type { ItemKind, ItemProgress } from '@/types/progress'
import { itemKey } from '@/types/progress'
import { createItemProgress } from '@/db/progressRepo'
import { isMastered, isWeak, overdueDays } from './mastery'
import type { Rng } from '@/utils/random'

/**
 * Item selection.
 *
 * The rule that matters: a word you know perfectly must not keep showing up,
 * and a word you keep failing must come back soon. Everything below is in
 * service of that.
 */

export type Bucket = 'due' | 'weak' | 'new' | 'learning' | 'mastered'

/** Default mix for a normal training block. */
export const DEFAULT_MIX: Record<Bucket, number> = {
  due: 0.5,
  weak: 0.25,
  new: 0.2,
  mastered: 0.05,
  learning: 0,
}

/** Mix used by "allenati sugli errori" — almost everything is weak material. */
export const MISTAKES_MIX: Record<Bucket, number> = {
  weak: 0.7,
  due: 0.3,
  new: 0,
  mastered: 0,
  learning: 0,
}

export interface Schedulable {
  id: string
  /** Lower = introduced earlier. Words use frequencyRank, phrases use their order. */
  order: number
}

export interface ScheduledItem<T extends Schedulable> {
  item: T
  progress: ItemProgress
  bucket: Bucket
  /** Higher = more urgent. Exposed for tests and debugging. */
  score: number
}

export function classify(progress: ItemProgress | undefined, now: number): Bucket {
  if (!progress || progress.seenCount === 0) return 'new'
  if (isMastered(progress)) {
    return progress.nextReviewAt <= now ? 'due' : 'mastered'
  }
  if (progress.nextReviewAt <= now) return 'due'
  if (isWeak(progress)) return 'weak'
  return 'learning'
}

/**
 * Urgency inside a bucket.
 * - due: the more overdue, the higher
 * - weak: the lower the mastery, the higher
 * - new: the more frequent the word, the higher
 * - mastered: barely matters, keep it near zero so it never crowds anything out
 */
function scoreOf<T extends Schedulable>(
  bucket: Bucket,
  item: T,
  progress: ItemProgress,
  now: number,
): number {
  switch (bucket) {
    case 'due':
      return 100 + Math.min(60, overdueDays(progress, now)) + progress.perceivedDifficulty * 10
    case 'weak':
      return 80 + (1 - progress.mastery) * 40 + progress.wrongCount * 2
    case 'new':
      return 50 - item.order / 100
    case 'learning':
      return 30 + (1 - progress.mastery) * 10
    case 'mastered':
      return 5
  }
}

export interface SelectOptions {
  count: number
  now?: number
  mix?: Partial<Record<Bucket, number>>
  /** Item ids to exclude (already queued in another stage). */
  exclude?: Set<string>
  /** Restrict the pool, e.g. to one category in free-training mode. */
  filter?: (item: Schedulable) => boolean
}

/**
 * Picks `count` items from `pool`, respecting the bucket mix and falling back
 * gracefully when a bucket runs dry (a brand-new user has no reviews; a
 * finished user has no new words).
 */
export function selectItems<T extends Schedulable>(
  kind: ItemKind,
  pool: readonly T[],
  progressByKey: Map<string, ItemProgress>,
  rng: Rng,
  options: SelectOptions,
): ScheduledItem<T>[] {
  const now = options.now ?? Date.now()
  const mix = { ...DEFAULT_MIX, ...options.mix }
  const exclude = options.exclude ?? new Set<string>()

  const buckets: Record<Bucket, ScheduledItem<T>[]> = {
    due: [],
    weak: [],
    new: [],
    learning: [],
    mastered: [],
  }

  for (const item of pool) {
    if (exclude.has(item.id)) continue
    if (options.filter && !options.filter(item)) continue
    const progress =
      progressByKey.get(itemKey(kind, item.id)) ?? createItemProgress(kind, item.id, now)
    const bucket = classify(progressByKey.get(itemKey(kind, item.id)), now)
    buckets[bucket].push({
      item,
      progress,
      bucket,
      score: scoreOf(bucket, item, progress, now),
    })
  }

  for (const list of Object.values(buckets)) {
    list.sort((a, b) => b.score - a.score)
  }

  // New items are introduced in frequency order, but with a little jitter so
  // two sessions in a row don't start with the exact same three words.
  buckets.new = jitterTop(buckets.new, rng, 8)

  const picked: ScheduledItem<T>[] = []
  const takenIds = new Set<string>()

  const quota = (bucket: Bucket) => Math.round(options.count * (mix[bucket] ?? 0))

  const order: Bucket[] = ['due', 'weak', 'new', 'mastered']
  for (const bucket of order) {
    const want = quota(bucket)
    for (const candidate of buckets[bucket]) {
      if (picked.length >= options.count) break
      if (picked.filter((p) => p.bucket === bucket).length >= want) break
      if (takenIds.has(candidate.item.id)) continue
      picked.push(candidate)
      takenIds.add(candidate.item.id)
    }
  }

  // Backfill in priority order until we hit the requested count.
  const fallback: Bucket[] = ['due', 'weak', 'learning', 'new', 'mastered']
  for (const bucket of fallback) {
    for (const candidate of buckets[bucket]) {
      if (picked.length >= options.count) break
      if (takenIds.has(candidate.item.id)) continue
      picked.push(candidate)
      takenIds.add(candidate.item.id)
    }
    if (picked.length >= options.count) break
  }

  return picked
}

/** Shuffles the first `window` entries so the head of the list varies. */
function jitterTop<T>(list: T[], rng: Rng, window: number): T[] {
  if (list.length <= 1) return list
  const head = rng.shuffle(list.slice(0, window))
  return [...head, ...list.slice(window)]
}

/**
 * Alphabet-specific queue.
 *
 * Letters you keep confusing must come back far more often than letters you
 * already read fluently — but every letter still needs an occasional check, so
 * mastered letters keep a small residual weight instead of dropping to zero.
 */
export function weightForLetter(progress: ItemProgress | undefined, now: number): number {
  if (!progress || progress.seenCount === 0) return 6
  if (progress.nextReviewAt <= now) return 4 + Math.min(4, overdueDays(progress, now))
  if (isWeak(progress)) return 8 + progress.perceivedDifficulty * 6
  if (isMastered(progress)) return 0.6
  return 2 + (1 - progress.mastery) * 3
}

/**
 * Weighted draw without immediate repeats. Returns a queue of letter ids of
 * the requested length.
 */
export function buildLetterQueue(
  letterIds: readonly string[],
  progressByKey: Map<string, ItemProgress>,
  rng: Rng,
  count: number,
  now = Date.now(),
): string[] {
  const weights = letterIds.map((id) => ({
    id,
    weight: weightForLetter(progressByKey.get(itemKey('letter', id)), now),
  }))

  const queue: string[] = []
  let lastId: string | null = null
  let secondLastId: string | null = null

  for (let i = 0; i < count; i++) {
    const eligible = weights.filter((w) => w.id !== lastId && w.id !== secondLastId)
    const pool = eligible.length > 0 ? eligible : weights
    const total = pool.reduce((sum, w) => sum + w.weight, 0)
    let ticket = rng.next() * total
    let chosen = pool[pool.length - 1].id
    for (const entry of pool) {
      ticket -= entry.weight
      if (ticket <= 0) {
        chosen = entry.id
        break
      }
    }
    queue.push(chosen)
    secondLastId = lastId
    lastId = chosen
  }

  return queue
}

/** Loads progress rows into a lookup keyed by `kind:id`. */
export function toProgressMap(items: ItemProgress[]): Map<string, ItemProgress> {
  return new Map(items.map((item) => [item.key, item]))
}
