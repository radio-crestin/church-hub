import { useCallback } from 'react'

import { useSchedules } from './useSchedules'
import { useUpsertSchedule } from './useUpsertSchedule'
import { todayProgramTitle } from '../utils/todayProgramTitle'

/**
 * One click to today's program: returns the id of the program named after
 * today's date, creating it only when it does not exist yet — pressing
 * "Today" twice must not leave two programs with the same name.
 */
export function useCreateTodayProgram() {
  const { data: schedules = [] } = useSchedules()
  const upsertSchedule = useUpsertSchedule()

  const createTodayProgram = useCallback(async (): Promise<number | null> => {
    const title = todayProgramTitle()
    const existing = schedules.find((schedule) => schedule.title === title)
    if (existing) return existing.id

    const result = await upsertSchedule.mutateAsync({ title })
    return result.success && result.data ? result.data.id : null
  }, [schedules, upsertSchedule])

  return { createTodayProgram, isPending: upsertSchedule.isPending }
}
