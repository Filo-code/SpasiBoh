import { create } from 'zustand'
import type { AppSettings, GlobalStats, ItemKind, ItemProgress } from '@/types/progress'
import { itemKey } from '@/types/progress'
import { DEFAULT_SETTINGS, DEFAULT_STATS } from '@/db/database'
import {
  createItemProgress,
  getAllItems,
  getSettings,
  getStats,
  putItem,
  recordActivity,
  resetAllProgress,
  saveSettings,
} from '@/db/progressRepo'
import { applyAnswer } from '@/engine/mastery'

/**
 * Global app state.
 *
 * Deliberately thin: it holds the user's settings and an in-memory mirror of
 * the progress table so screens can render instantly, and it funnels every
 * write through the repository. No exercise state lives here — that belongs to
 * the session component that owns it.
 */

interface AppState {
  ready: boolean
  settings: AppSettings
  stats: GlobalStats
  items: ItemProgress[]
  itemsByKey: Map<string, ItemProgress>

  load(): Promise<void>
  reload(): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
  progressFor(kind: ItemKind, id: string): ItemProgress
  recordAnswer(input: RecordAnswerInput): Promise<ItemProgress>
  resetProgress(): Promise<void>
}

export interface RecordAnswerInput {
  kind: ItemKind
  id: string
  correct: boolean
  exerciseType: string
  elapsedMs: number
  /** Speech exercises that could not run are not scored at all. */
  skipped?: boolean
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  stats: DEFAULT_STATS,
  items: [],
  itemsByKey: new Map(),

  async load() {
    if (get().ready) return
    await get().reload()
  },

  async reload() {
    const [settings, stats, items] = await Promise.all([getSettings(), getStats(), getAllItems()])
    set({
      ready: true,
      settings,
      stats,
      items,
      itemsByKey: new Map(items.map((item) => [item.key, item])),
    })
  },

  async updateSettings(patch) {
    const settings = await saveSettings(patch)
    set({ settings })
  },

  progressFor(kind, id) {
    return get().itemsByKey.get(itemKey(kind, id)) ?? createItemProgress(kind, id)
  },

  async recordAnswer(input) {
    const state = get()
    const key = itemKey(input.kind, input.id)
    const existing = state.itemsByKey.get(key) ?? createItemProgress(input.kind, input.id)

    if (input.skipped) return existing

    const wasNew = existing.seenCount === 0
    const updated = applyAnswer(existing, input.correct, input.exerciseType)

    await putItem(updated)
    await recordActivity({
      elapsedMs: input.elapsedMs,
      correct: input.correct,
      isNewItem: wasNew,
    })

    const nextByKey = new Map(state.itemsByKey)
    nextByKey.set(key, updated)
    const nextItems = state.items.some((item) => item.key === key)
      ? state.items.map((item) => (item.key === key ? updated : item))
      : [...state.items, updated]

    const stats = await getStats()
    set({ items: nextItems, itemsByKey: nextByKey, stats })
    return updated
  },

  async resetProgress() {
    await resetAllProgress()
    await get().reload()
  },
}))

/** Selector helpers so components don't re-render on unrelated changes. */
export const selectSettings = (state: AppState) => state.settings
export const selectStats = (state: AppState) => state.stats
export const selectItems = (state: AppState) => state.items
