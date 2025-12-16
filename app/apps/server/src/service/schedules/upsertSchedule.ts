import { eq, sql } from 'drizzle-orm'

import { updateScheduleSearchIndex } from './search'
import type { Schedule, UpsertScheduleInput } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Creates or updates a schedule
 */
export function upsertSchedule(input: UpsertScheduleInput): Schedule | null {
  try {
    log('debug', `Upserting schedule: ${input.id ?? 'new'}`)

    const db = getDatabase()
    const now = new Date()

    let scheduleId: number

    if (input.id) {
      // Update existing schedule
      db.update(schedules)
        .set({
          title: input.title,
          description: input.description ?? null,
          updatedAt: now,
        })
        .where(eq(schedules.id, input.id))
        .run()
      scheduleId = input.id
      log('info', `Schedule updated: ${scheduleId}`)
    } else {
      // Create new schedule
      const result = db
        .insert(schedules)
        .values({
          title: input.title,
          description: input.description ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schedules.id })
        .get()
      scheduleId = result.id
      log('info', `Schedule created: ${scheduleId}`)
    }

    // Update search index
    updateScheduleSearchIndex(scheduleId)

    // Get counts for response
    const counts = db
      .select({
        itemCount: sql<number>`CAST(COUNT(${scheduleItems.id}) AS INTEGER)`,
        songCount: sql<number>`CAST(SUM(CASE WHEN ${scheduleItems.itemType} = 'song' THEN 1 ELSE 0 END) AS INTEGER)`,
      })
      .from(scheduleItems)
      .where(eq(scheduleItems.scheduleId, scheduleId))
      .get()

    // Get updated schedule
    const schedule = db
      .select()
      .from(schedules)
      .where(eq(schedules.id, scheduleId))
      .get()

    if (!schedule) {
      log('error', `Failed to retrieve schedule after upsert: ${scheduleId}`)
      return null
    }

    return {
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      itemCount: counts?.itemCount ?? 0,
      songCount: counts?.songCount ?? 0,
      createdAt: Math.floor(schedule.createdAt.getTime() / 1000),
      updatedAt: Math.floor(schedule.updatedAt.getTime() / 1000),
    }
  } catch (error) {
    log('error', `Failed to upsert schedule: ${error}`)
    return null
  }
}
