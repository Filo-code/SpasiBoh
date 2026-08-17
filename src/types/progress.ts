/**
 * User progress types.
 *
 * These are the only things that get written to IndexedDB. Static content is
 * referenced by id — never copied in here.
 */

export type ItemKind = 'letter' | 'word' | 'phrase'

/** Composite key used everywhere: `word:vokzal`, `letter:zh`, `phrase:metro-01`. */
export type ItemKey = string

export function itemKey(kind: ItemKind, id: string): ItemKey {
  return `${kind}:${id}`
}

export function parseItemKey(key: ItemKey): { kind: ItemKind; id: string } {
  const idx = key.indexOf(':')
  return { kind: key.slice(0, idx) as ItemKind, id: key.slice(idx + 1) }
}

/**
 * Per-item scheduling + performance record. One row per learning item the user
 * has actually seen; unseen items simply have no row.
 */
export interface ItemProgress {
  key: ItemKey
  kind: ItemKind
  id: string
  seenCount: number
  correctCount: number
  wrongCount: number
  /** Consecutive correct answers. Resets to 0 on a mistake. */
  streak: number
  /** Longest streak ever reached, kept for stats. */
  bestStreak: number
  /** 0..1 — see `engine/mastery.ts`. */
  mastery: number
  /** SM-2-ish ease factor, clamped to [1.3, 2.8]. */
  ease: number
  /** Current review interval in days. */
  intervalDays: number
  /** Leitner-style box 0..5, mostly used for readable debugging + UI. */
  box: number
  lastSeenAt: number
  nextReviewAt: number
  /** Timestamp of the first exposure, used for "new words this week". */
  firstSeenAt: number
  /** Exercise types already used for this item, so the engine can rotate. */
  recentExerciseTypes: string[]
  /** Difficulty as *experienced* by the user (rises when they keep failing). */
  perceivedDifficulty: number
}

export interface SessionStageResult {
  stage: SessionStageId
  correct: number
  total: number
  /** Milliseconds actually spent in the stage. */
  durationMs: number
}

export type SessionStageId =
  | 'warmup'
  | 'words'
  | 'listening'
  | 'sentences'
  | 'travel'
  | 'review'

export interface SessionRecord {
  id?: number
  startedAt: number
  endedAt: number
  durationMs: number
  /** Actual answering time, excluding idle/paused moments. */
  activeMs: number
  correct: number
  total: number
  newItems: number
  stages: SessionStageResult[]
  /** Item keys that were answered wrong at least once during the session. */
  weakKeys: ItemKey[]
  completed: boolean
  /** `daily` for the guided session, otherwise the free-training mode used. */
  mode: string
}

/** One row per calendar day the user studied. Keyed by `YYYY-MM-DD` local date. */
export interface DayStat {
  date: string
  studiedMs: number
  exercises: number
  correct: number
  sessions: number
  newItems: number
}

export interface AppSettings {
  id: 'settings'
  userName: string
  /** Preferred speech-synthesis voice URI, if the user picked one. */
  voiceURI: string | null
  speechRate: number
  slowSpeechRate: number
  /** Auto-play audio in listening exercises. */
  autoPlayAudio: boolean
  /** Ask for microphone exercises during the daily session. */
  pronunciationEnabled: boolean
  /** Target correct answers in the alphabet warm-up. */
  warmupTarget: number
  /** Soft time budget for the warm-up, in minutes. */
  warmupMinutes: number
  /** Number of vocabulary questions per daily session. */
  wordsPerSession: number
  /** Haptics + sound effects. */
  reducedMotion: boolean
  createdAt: number
}

export interface GlobalStats {
  id: 'global'
  currentStreak: number
  bestStreak: number
  lastStudyDate: string | null
  totalStudiedMs: number
  totalSessions: number
  totalExercises: number
  totalCorrect: number
  /** Days on which at least one exercise was answered. */
  studyDays: number
}

/** Payload written by `Esporta progresso` and read by `Importa progresso`. */
export interface BackupFile {
  format: 'russo-trainer-backup'
  version: number
  exportedAt: number
  appVersion: string
  data: {
    items: ItemProgress[]
    sessions: SessionRecord[]
    days: DayStat[]
    settings: AppSettings | null
    stats: GlobalStats | null
  }
}
