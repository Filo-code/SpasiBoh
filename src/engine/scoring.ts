import type { ItemProgress, SessionStageResult } from '@/types/progress'
import type { WordCategory } from '@/types/content'
import { CATEGORY_LABELS } from '@/types/content'
import { WORDS_BY_ID } from '@/data/words'
import { ALPHABET } from '@/data/alphabet'
import { itemKey } from '@/types/progress'
import { isMastered } from './mastery'

/** Aggregations used by the recap and the statistics page. */

export function percent(correct: number, total: number): number {
  if (total === 0) return 0
  return Math.round((correct / total) * 100)
}

export interface CategoryMastery {
  category: WordCategory
  label: string
  mastery: number
  seen: number
  total: number
}

/**
 * Average mastery per word category. Categories the user has not touched yet
 * report mastery 0 with `seen: 0` so the UI can grey them out instead of
 * pretending they are "weak".
 */
export function categoryMastery(items: ItemProgress[], totalsByCategory: Map<WordCategory, number>): CategoryMastery[] {
  const sums = new Map<WordCategory, { sum: number; seen: number }>()

  for (const item of items) {
    if (item.kind !== 'word') continue
    const word = WORDS_BY_ID[item.id]
    if (!word) continue
    const entry = sums.get(word.category) ?? { sum: 0, seen: 0 }
    entry.sum += item.mastery
    entry.seen += 1
    sums.set(word.category, entry)
  }

  return [...totalsByCategory.entries()]
    .map(([category, total]) => {
      const entry = sums.get(category)
      return {
        category,
        label: CATEGORY_LABELS[category],
        mastery: entry && entry.seen > 0 ? entry.sum / entry.seen : 0,
        seen: entry?.seen ?? 0,
        total,
      }
    })
    .toSorted((a, b) => b.mastery - a.mastery)
}

export interface SessionSummary {
  correct: number
  total: number
  accuracy: number
  stages: (SessionStageResult & { accuracy: number })[]
  strongestStage: SessionStageResult | null
  weakestStage: SessionStageResult | null
}

export function summarizeSession(stages: SessionStageResult[]): SessionSummary {
  const scored = stages
    .filter((stage) => stage.total > 0)
    .map((stage) => ({
      stage: stage.stage,
      correct: stage.correct,
      total: stage.total,
      durationMs: stage.durationMs,
      accuracy: stage.correct / stage.total,
    }))

  const correct = scored.reduce((sum, s) => sum + s.correct, 0)
  const total = scored.reduce((sum, s) => sum + s.total, 0)

  const sortedByAccuracy = scored.toSorted((a, b) => b.accuracy - a.accuracy)

  return {
    correct,
    total,
    accuracy: total === 0 ? 0 : correct / total,
    stages: scored,
    strongestStage: sortedByAccuracy[0] ?? null,
    weakestStage: sortedByAccuracy[sortedByAccuracy.length - 1] ?? null,
  }
}

export interface OverallStats {
  wordsSeen: number
  wordsLearned: number
  phrasesSeen: number
  phrasesLearned: number
  lettersMastered: number
  overallMastery: number
  accuracy: number
}

/** The numbers shown on the home dashboard. */
export function overallStats(
  items: ItemProgress[],
  totals: { totalCorrect: number; totalExercises: number },
): OverallStats {
  const words = items.filter((i) => i.kind === 'word')
  const phrases = items.filter((i) => i.kind === 'phrase')
  const letters = items.filter((i) => i.kind === 'letter')

  const masterySum = items.reduce((sum, item) => sum + item.mastery, 0)

  return {
    wordsSeen: words.length,
    wordsLearned: words.filter((w) => w.mastery >= 0.6).length,
    phrasesSeen: phrases.length,
    phrasesLearned: phrases.filter((p) => p.mastery >= 0.6).length,
    lettersMastered: letters.filter(isMastered).length,
    overallMastery: items.length === 0 ? 0 : masterySum / items.length,
    accuracy: totals.totalExercises === 0 ? 0 : totals.totalCorrect / totals.totalExercises,
  }
}

/** Letters that still need work, worst first — used by the recap and mistakes page. */
export function weakLetters(items: ItemProgress[], limit = 5): { id: string; upper: string; accuracy: number }[] {
  const byKey = new Map(items.map((i) => [i.key, i]))
  return ALPHABET.map((letter) => {
    const progress = byKey.get(itemKey('letter', letter.id))
    if (!progress || progress.seenCount === 0) return null
    return {
      id: letter.id,
      upper: letter.upper,
      accuracy: progress.correctCount / progress.seenCount,
      mastery: progress.mastery,
    }
  })
    .filter((entry): entry is { id: string; upper: string; accuracy: number; mastery: number } => entry !== null)
    .filter((entry) => entry.accuracy < 0.85)
    .toSorted((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit)
    .map(({ id, upper, accuracy }) => ({ id, upper, accuracy }))
}
