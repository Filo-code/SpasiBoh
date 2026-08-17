import { useEffect, useState } from 'react'
import type { DayStat } from '@/types/progress'
import { getDays, getToday } from '@/db/progressRepo'
import { useAppStore } from '@/store/appStore'

/** Today's row, refreshed whenever an answer is recorded. */
export function useToday(): DayStat | null {
  const totalExercises = useAppStore((state) => state.stats.totalExercises)
  const [day, setDay] = useState<DayStat | null>(null)

  useEffect(() => {
    let cancelled = false
    getToday().then((value) => {
      if (!cancelled) setDay(value ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [totalExercises])

  return day
}

/** The last `limit` days, oldest first — used by the activity chart. */
export function useDayHistory(limit = 30): DayStat[] {
  const totalExercises = useAppStore((state) => state.stats.totalExercises)
  const [days, setDays] = useState<DayStat[]>([])

  useEffect(() => {
    let cancelled = false
    getDays(limit).then((value) => {
      if (!cancelled) setDays(value)
    })
    return () => {
      cancelled = true
    }
  }, [limit, totalExercises])

  return days
}
