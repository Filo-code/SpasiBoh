export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

/** Local calendar date as `YYYY-MM-DD` — the key used by daily stats. */
export function localDateKey(at: number | Date = Date.now()): string {
  const d = at instanceof Date ? at : new Date(at)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Number of whole calendar days between two `YYYY-MM-DD` keys. */
export function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00`)
  const to = Date.parse(`${toKey}T00:00:00`)
  return Math.round((to - from) / DAY)
}

/** `mm:ss` */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** `18:42 minuti` style, used in the session recap. */
export function formatMinutes(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Rounded minutes, for the dashboard counters. */
export function toMinutes(ms: number): number {
  return Math.round(ms / MINUTE)
}

/** Human "fra 3 giorni" / "oggi" for the next review date. */
export function formatRelativeDay(timestamp: number, now = Date.now()): string {
  const diff = daysBetween(localDateKey(now), localDateKey(timestamp))
  if (diff <= 0) return 'ora'
  if (diff === 1) return 'domani'
  if (diff < 30) return `fra ${diff} giorni`
  const months = Math.round(diff / 30)
  return months === 1 ? 'fra un mese' : `fra ${months} mesi`
}

/** "3 giorni fa" for the mistakes page. */
export function formatAgo(timestamp: number | null | undefined, now = Date.now()): string {
  if (!timestamp) return 'mai'
  const diff = daysBetween(localDateKey(timestamp), localDateKey(now))
  if (diff <= 0) return 'oggi'
  if (diff === 1) return 'ieri'
  if (diff < 30) return `${diff} giorni fa`
  const months = Math.round(diff / 30)
  return months === 1 ? 'un mese fa' : `${months} mesi fa`
}
