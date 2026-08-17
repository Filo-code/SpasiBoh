import type { ItemProgress } from '@/types/progress'
import { DAY, MINUTE } from '@/utils/time'

/**
 * Mastery + spaced repetition.
 *
 * The scheduling is SM-2 *inspired* rather than a faithful reimplementation:
 * there is no 0–5 self-grading, only right/wrong, because that is all the
 * exercises can honestly produce. What we keep from SM-2 is the ease factor
 * and the multiplicative interval growth; what we keep from Leitner is the
 * readable box number.
 */

/** Consecutive correct answers that count as "solid". */
export const TARGET_STREAK = 5
/** Review interval (days) at which retention is considered complete. */
export const MASTERY_INTERVAL_DAYS = 21
/** Below this many exposures we do not trust the accuracy number yet. */
export const MIN_EXPOSURES = 3

export const MIN_EASE = 1.3
export const MAX_EASE = 2.8
export const MAX_BOX = 5

/** Wrong answers come back within the same session. */
export const RELEARN_DELAY_MS = 8 * MINUTE

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/**
 * 0..1 mastery.
 *
 * Blends three independent signals so that no single one can fake it:
 * - accuracy: did you get it right historically
 * - streak: are you getting it right *now*
 * - retention: has it survived a long gap
 *
 * The whole thing is scaled down while exposures are few, so a lucky first
 * guess cannot jump straight to "padroneggiata".
 */
export function computeMastery(p: Pick<
  ItemProgress,
  'seenCount' | 'correctCount' | 'streak' | 'intervalDays'
>): number {
  if (p.seenCount === 0) return 0
  const accuracy = p.correctCount / p.seenCount
  const streakFactor = Math.min(p.streak / TARGET_STREAK, 1)
  const retention = Math.min(p.intervalDays / MASTERY_INTERVAL_DAYS, 1)
  const confidence = Math.min(p.seenCount / MIN_EXPOSURES, 1)
  return clamp01((0.45 * accuracy + 0.25 * streakFactor + 0.3 * retention) * confidence)
}

export type MasteryLevel = 'nuovo' | 'debole' | 'in-corso' | 'buono' | 'padroneggiato'

export function masteryLevel(mastery: number, seenCount = 1): MasteryLevel {
  if (seenCount === 0) return 'nuovo'
  if (mastery < 0.3) return 'debole'
  if (mastery < 0.6) return 'in-corso'
  if (mastery < 0.85) return 'buono'
  return 'padroneggiato'
}

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  nuovo: 'Nuovo',
  debole: 'Debole',
  'in-corso': 'In corso',
  buono: 'Buono',
  padroneggiato: 'Padroneggiato',
}

/** Accuracy as a percentage, or `null` when the item has never been seen. */
export function accuracyOf(p: Pick<ItemProgress, 'seenCount' | 'correctCount'>): number | null {
  if (p.seenCount === 0) return null
  return p.correctCount / p.seenCount
}

/**
 * An item is "weak" when it is actively costing you: low mastery *and*
 * evidence of real mistakes. Never-seen items are not weak, they are new.
 */
export function isWeak(p: ItemProgress): boolean {
  if (p.seenCount === 0) return false
  if (p.wrongCount === 0) return false
  const accuracy = p.correctCount / p.seenCount
  return p.mastery < 0.5 || accuracy < 0.65 || p.streak === 0
}

export function isMastered(p: ItemProgress): boolean {
  return p.mastery >= 0.85 && p.streak >= TARGET_STREAK
}

/**
 * Applies one answer to an item, returning a *new* record.
 *
 * `exerciseType` is remembered so the factory can rotate formats and avoid
 * showing the same question shape twice in a row.
 */
export function applyAnswer(
  progress: ItemProgress,
  correct: boolean,
  exerciseType: string,
  now = Date.now(),
): ItemProgress {
  const next: ItemProgress = { ...progress }

  next.seenCount += 1
  next.lastSeenAt = now
  if (next.firstSeenAt === 0) next.firstSeenAt = now

  if (correct) {
    next.correctCount += 1
    next.streak += 1
    next.bestStreak = Math.max(next.bestStreak, next.streak)
    next.ease = Math.min(MAX_EASE, next.ease + 0.1)
    next.box = Math.min(MAX_BOX, next.box + 1)
    next.perceivedDifficulty = Math.max(0, next.perceivedDifficulty - 0.08)

    if (next.box === 1) next.intervalDays = 1
    else if (next.box === 2) next.intervalDays = 3
    else next.intervalDays = Math.min(180, Math.round(next.intervalDays * next.ease) || 1)

    next.nextReviewAt = now + next.intervalDays * DAY
  } else {
    next.wrongCount += 1
    next.streak = 0
    next.ease = Math.max(MIN_EASE, next.ease - 0.25)
    next.box = Math.max(0, next.box - 2)
    next.intervalDays = 0
    next.perceivedDifficulty = Math.min(1, next.perceivedDifficulty + 0.15)
    // Come back inside this session, but not as the very next question.
    next.nextReviewAt = now + RELEARN_DELAY_MS
  }

  next.mastery = computeMastery(next)
  next.recentExerciseTypes = [exerciseType, ...next.recentExerciseTypes].slice(0, 4)

  return next
}

/**
 * How overdue an item is, in days. Negative means "not due yet".
 * Used to rank the review queue.
 */
export function overdueDays(p: ItemProgress, now = Date.now()): number {
  return (now - p.nextReviewAt) / DAY
}
