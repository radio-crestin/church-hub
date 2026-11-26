import { eq, ne, sql } from 'drizzle-orm'

import { automationColumns } from './automationColumns'
import { childScheduleIds } from './childScheduleIds'
import { updateScheduleSearchIndex } from './search'
import { toScheduleAutomation } from './toScheduleAutomation'
import type { Schedule, UpsertScheduleInput } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('schedules')

/**
 * Creates or updates a schedule
 */
export function upsertSchedule(input: UpsertScheduleInput): Schedule | null {
  try {
    logger.debug(`Upserting schedule: ${input.id ?? 'new'}`)

    const db = getDatabase()
    const now = new Date()

    let scheduleId: number

    if (input.id) {
      // Update existing schedule
      db.update(schedules)
        .set({
          title: input.title,
          description: input.description ?? null,
          ...automationColumns(input.automation),
          updatedAt: now,
        })
        .where(eq(schedules.id, input.id))
        .run()
      scheduleId = input.id
      logger.info(`Schedule updated: ${scheduleId}`)
    } else {
      // Create new schedule
      const result = db
        .insert(schedules)
        .values({
          title: input.title,
          description: input.description ?? null,
          ...automationColumns(input.automation),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: schedules.id })
        .get()
      scheduleId = result.id
      logger.info(`Schedule created: ${scheduleId}`)
    }

    // One presentation at most starts with the app.
    if (input.automation?.startOnAppStart) {
      db.update(schedules)
        .set({ startOnAppStart: false })
        .where(ne(schedules.id, scheduleId))
        .run()
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
      logger.error(`Failed to retrieve schedule after upsert: ${scheduleId}`)
      return null
    }

    return {
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      automation: toScheduleAutomation(schedule),
      templateId: schedule.templateId,
      itemCount: counts?.itemCount ?? 0,
      songCount: counts?.songCount ?? 0,
      childScheduleIds: childScheduleIds().get(scheduleId) ?? [],
      createdAt: Math.floor(schedule.createdAt.getTime() / 1000),
      updatedAt: Math.floor(schedule.updatedAt.getTime() / 1000),
    }
  } catch (error) {
    logger.error(`Failed to upsert schedule: ${error}`)
    return null
  }
}
