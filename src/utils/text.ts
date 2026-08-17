/**
 * Text normalisation used to compare what the browser *thinks* it heard with
 * what we asked for.
 *
 * This is intentionally forgiving: browser speech recognition is a black box
 * and will happily return "где вокзал" for "Где вокзал?" or drop the ё. We are
 * checking "did the recogniser produce the expected Russian", not grading
 * accent quality.
 */

/** Combining acute accent used in the `stress` fields. */
const COMBINING_ACUTE = '́'

/** Strips the stress marks so `вокза́л` compares equal to `вокзал`. */
export function stripStressMarks(text: string): string {
  return text.replaceAll(COMBINING_ACUTE, '')
}

/**
 * Canonical form for comparison:
 * - lowercase
 * - ё → е (both spellings are used in the wild)
 * - й → и is NOT applied: that would be too lossy
 * - punctuation removed, whitespace collapsed
 * - stress marks removed
 */
export function normalizeRussian(text: string): string {
  return stripStressMarks(text)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,!?;:«»"'()\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Same idea for Italian answers (typing mode). */
export function normalizeItalian(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[.,!?;:«»"'()\-–—…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Levenshtein distance, capped for performance on long strings.
 * Used to accept near-misses from speech recognition.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr: number[] = Array.from({ length: b.length + 1 }, () => 0)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

/** 0..1 similarity based on edit distance. */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export interface SpeechMatch {
  matched: boolean
  /** 0..1 — how close the best transcript was. */
  score: number
  /** The transcript that scored best. */
  best: string
}

/**
 * Compares speech-recognition transcripts against the expected phrase.
 *
 * A short single word must be almost exact (threshold rises as the target gets
 * shorter) because "кот" vs "кит" is a real mistake; longer phrases are allowed
 * more slack because recognisers routinely swallow particles.
 */
export function matchSpeech(
  transcripts: string[],
  expected: string,
  extraAccepted: string[] = [],
): SpeechMatch {
  const targets = [expected, ...extraAccepted].map(normalizeRussian).filter(Boolean)
  let best = ''
  let bestScore = 0

  for (const raw of transcripts) {
    const heard = normalizeRussian(raw)
    if (!heard) continue
    for (const target of targets) {
      const score = similarity(heard, target)
      if (score > bestScore) {
        bestScore = score
        best = raw.trim()
      }
    }
  }

  const targetLength = normalizeRussian(expected).length
  const threshold = targetLength <= 4 ? 0.95 : targetLength <= 8 ? 0.82 : 0.75

  return { matched: bestScore >= threshold, score: bestScore, best }
}

/**
 * Splits a Russian sentence into the blocks used by the sentence-building
 * game. Punctuation stays attached to its word so the assembled string can be
 * compared directly with the original.
 */
export function toBlocks(sentence: string): string[] {
  return sentence.split(/\s+/).filter(Boolean)
}

/** Joins blocks back into a sentence. */
export function fromBlocks(blocks: string[]): string {
  return blocks.join(' ')
}

/** True when the assembled blocks form the target sentence. */
export function blocksMatch(blocks: string[], target: string): boolean {
  return normalizeRussian(fromBlocks(blocks)) === normalizeRussian(target)
}

/** Capitalises the first letter, leaving the rest untouched. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
