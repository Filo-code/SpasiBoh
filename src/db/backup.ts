import { db } from './database'
import type { BackupFile, ItemProgress, SessionRecord, DayStat } from '@/types/progress'

export const BACKUP_FORMAT = 'russo-trainer-backup'
export const BACKUP_VERSION = 1
export const APP_VERSION = '1.0.0'

export async function exportProgress(): Promise<BackupFile> {
  const [items, sessions, days, settings, stats] = await Promise.all([
    db.items.toArray(),
    db.sessions.toArray(),
    db.days.toArray(),
    db.settings.get('settings'),
    db.stats.get('global'),
  ])

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
    data: {
      items,
      sessions,
      days,
      settings: settings ?? null,
      stats: stats ?? null,
    },
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  summary?: {
    items: number
    sessions: number
    days: number
    exportedAt: number
  }
}

/**
 * Validates an imported file *before* touching the database. We would rather
 * refuse a weird file than half-overwrite months of progress.
 */
export function validateBackup(input: unknown): ValidationResult {
  const errors: string[] = []

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['Il file non contiene un oggetto JSON valido.'] }
  }
  const file = input as Partial<BackupFile>

  if (file.format !== BACKUP_FORMAT) {
    errors.push(`Formato non riconosciuto (atteso "${BACKUP_FORMAT}").`)
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    errors.push('Versione del backup non supportata da questa versione dell\'app.')
  }
  if (typeof file.data !== 'object' || file.data === null) {
    errors.push('Sezione "data" mancante.')
    return { valid: false, errors }
  }

  const data = file.data as BackupFile['data']

  if (!Array.isArray(data.items)) errors.push('"items" deve essere una lista.')
  if (!Array.isArray(data.sessions)) errors.push('"sessions" deve essere una lista.')
  if (!Array.isArray(data.days)) errors.push('"days" deve essere una lista.')

  if (Array.isArray(data.items)) {
    const seen = new Set<string>()
    for (const [index, raw] of data.items.entries()) {
      const item = raw as Partial<ItemProgress>
      if (typeof item.key !== 'string' || !item.key.includes(':')) {
        errors.push(`items[${index}]: chiave mancante o malformata.`)
        continue
      }
      if (seen.has(item.key)) errors.push(`items[${index}]: chiave duplicata "${item.key}".`)
      seen.add(item.key)
      if (item.kind !== 'letter' && item.kind !== 'word' && item.kind !== 'phrase') {
        errors.push(`items[${index}]: tipo "${String(item.kind)}" non valido.`)
      }
      if (typeof item.seenCount !== 'number' || item.seenCount < 0) {
        errors.push(`items[${index}]: seenCount non valido.`)
      }
      if (typeof item.mastery !== 'number' || item.mastery < 0 || item.mastery > 1) {
        errors.push(`items[${index}]: mastery fuori intervallo.`)
      }
      // Stop spamming after the first handful of broken rows.
      if (errors.length > 20) {
        errors.push('… altri errori omessi.')
        break
      }
    }
  }

  if (errors.length > 0) return { valid: false, errors }

  return {
    valid: true,
    errors: [],
    summary: {
      items: data.items.length,
      sessions: data.sessions.length,
      days: data.days.length,
      exportedAt: file.exportedAt ?? 0,
    },
  }
}

export type ImportMode = 'replace' | 'merge'

/**
 * Writes a validated backup into IndexedDB.
 *
 * `replace` wipes the local data first; `merge` keeps the *better* of the two
 * records for each item (more exposures wins), which is what you want when
 * moving between phone and laptop.
 */
export async function importProgress(
  file: BackupFile,
  mode: ImportMode = 'replace',
): Promise<void> {
  const validation = validateBackup(file)
  if (!validation.valid) {
    throw new Error(`Backup non valido: ${validation.errors.join(' ')}`)
  }

  await db.transaction('rw', db.items, db.sessions, db.days, db.settings, db.stats, async () => {
    if (mode === 'replace') {
      await Promise.all([db.items.clear(), db.sessions.clear(), db.days.clear()])
      await db.items.bulkPut(file.data.items)
      await db.sessions.bulkPut(stripSessionIds(file.data.sessions))
      await db.days.bulkPut(file.data.days)
      if (file.data.settings) await db.settings.put(file.data.settings)
      if (file.data.stats) await db.stats.put(file.data.stats)
      return
    }

    const existing = await db.items.toArray()
    const byKey = new Map(existing.map((i) => [i.key, i]))
    const merged: ItemProgress[] = []
    for (const incoming of file.data.items) {
      const local = byKey.get(incoming.key)
      merged.push(local ? mergeItem(local, incoming) : incoming)
      byKey.delete(incoming.key)
    }
    await db.items.bulkPut(merged)

    await db.sessions.bulkAdd(stripSessionIds(file.data.sessions))
    await mergeDays(file.data.days)
  })
}

function stripSessionIds(sessions: SessionRecord[]): SessionRecord[] {
  return sessions.map(({ id: _ignored, ...rest }) => rest as SessionRecord)
}

function mergeItem(local: ItemProgress, incoming: ItemProgress): ItemProgress {
  const winner = incoming.seenCount >= local.seenCount ? incoming : local
  return {
    ...winner,
    seenCount: Math.max(local.seenCount, incoming.seenCount),
    correctCount: Math.max(local.correctCount, incoming.correctCount),
    wrongCount: Math.max(local.wrongCount, incoming.wrongCount),
    bestStreak: Math.max(local.bestStreak, incoming.bestStreak),
    lastSeenAt: Math.max(local.lastSeenAt, incoming.lastSeenAt),
    firstSeenAt: Math.min(local.firstSeenAt || Infinity, incoming.firstSeenAt || Infinity),
  }
}

async function mergeDays(days: DayStat[]): Promise<void> {
  for (const incoming of days) {
    const local = await db.days.get(incoming.date)
    if (!local) {
      await db.days.put(incoming)
      continue
    }
    await db.days.put({
      date: incoming.date,
      studiedMs: Math.max(local.studiedMs, incoming.studiedMs),
      exercises: Math.max(local.exercises, incoming.exercises),
      correct: Math.max(local.correct, incoming.correct),
      sessions: Math.max(local.sessions, incoming.sessions),
      newItems: Math.max(local.newItems, incoming.newItems),
    })
  }
}

/** Suggested filename, e.g. `russo-progresso-2026-08-17.json`. */
export function backupFileName(at = Date.now()): string {
  const d = new Date(at)
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
  return `russo-progresso-${stamp}.json`
}
