import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  DayStat,
  GlobalStats,
  ItemProgress,
  SessionRecord,
} from '@/types/progress'

/**
 * IndexedDB schema.
 *
 * Only user progress lives here. Static learning content is bundled with the
 * app and referenced by id, so a content update never requires a migration.
 */
export class RussoDatabase extends Dexie {
  items!: EntityTable<ItemProgress, 'key'>
  sessions!: EntityTable<SessionRecord, 'id'>
  days!: EntityTable<DayStat, 'date'>
  settings!: EntityTable<AppSettings, 'id'>
  stats!: EntityTable<GlobalStats, 'id'>

  constructor(name = 'russo-trainer') {
    super(name)
    this.version(1).stores({
      items: 'key, kind, nextReviewAt, mastery, lastSeenAt',
      sessions: '++id, startedAt, mode',
      days: 'date',
      settings: 'id',
      stats: 'id',
    })
  }
}

export const db = new RussoDatabase()

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  userName: 'Микеле',
  voiceURI: null,
  speechRate: 0.95,
  slowSpeechRate: 0.55,
  autoPlayAudio: true,
  pronunciationEnabled: true,
  warmupTarget: 20,
  warmupMinutes: 10,
  wordsPerSession: 16,
  reducedMotion: false,
  createdAt: Date.now(),
}

export const DEFAULT_STATS: GlobalStats = {
  id: 'global',
  currentStreak: 0,
  bestStreak: 0,
  lastStudyDate: null,
  totalStudiedMs: 0,
  totalSessions: 0,
  totalExercises: 0,
  totalCorrect: 0,
  studyDays: 0,
}
