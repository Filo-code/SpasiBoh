/**
 * Seeded pseudo-random helpers.
 *
 * The learning engine is deterministic given (progress, seed). That makes it
 * testable, and it means a session generated at 9:00 differs from one at
 * 18:00 without relying on unseeded `Math.random()` sprinkled everywhere.
 */

export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [0, max) */
  int(max: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
  /** Picks `count` distinct items (or fewer if the pool is smaller). */
  sample<T>(items: readonly T[], count: number): T[]
}

/** mulberry32 — small, fast, good enough for shuffling exercises. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    int: (max) => Math.floor(next() * max),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
      }
      return out
    },
    sample: (items, count) => rng.shuffle(items).slice(0, count),
  }
  return rng
}

/** Derives a stable numeric seed from a string. */
export function seedFromString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
