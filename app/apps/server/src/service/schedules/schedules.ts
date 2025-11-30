import type {
  AddScheduleItemInput,
  CreateScheduleInput,
  OperationResult,
  ReorderItemsInput,
  Schedule,
  ScheduleItem,
  ScheduleItemResolved,
  ScheduleWithItems,
  UpdateScheduleInput,
} from './types'
import { getDatabase } from '../../db'
import { createLogger } from '../../utils/logger'
import { getSong } from '../songs/songs'

const logger = createLogger('SCHEDULES_SERVICE')

/**
 * Creates a new schedule
 */
export function createSchedule(input: CreateScheduleInput): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    logger.debug(`Creating schedule: ${input.title}`)
    const query = db.query(`
      INSERT INTO schedules (title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `)
    query.run(input.title, input.description ?? null, now, now)

    const lastId = db.query('SELECT last_insert_rowid() as id').get() as {
      id: number
    }
    logger.info(`Schedule created: ${lastId.id}`)
    return { success: true, id: lastId.id }
  } catch (error) {
    logger.error('Failed to create schedule', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Updates a schedule
 */
export function updateSchedule(
  id: number,
  input: UpdateScheduleInput,
): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.title !== undefined) {
      updates.push('title = ?')
      values.push(input.title)
    }

    if (input.description !== undefined) {
      updates.push('description = ?')
      values.push(input.description ?? null)
    }

    if (updates.length === 0) {
      return { success: true, id }
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const query = db.query(`
      UPDATE schedules SET ${updates.join(', ')} WHERE id = ?
    `)
    query.run(...values)

    logger.info(`Schedule updated: ${id}`)
    return { success: true, id }
  } catch (error) {
    logger.error('Failed to update schedule', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Deletes a schedule and all its items
 */
export function deleteSchedule(id: number): OperationResult {
  try {
    const db = getDatabase()

    // Delete items first
    db.query('DELETE FROM schedule_items WHERE schedule_id = ?').run(id)

    // Delete schedule
    db.query('DELETE FROM schedules WHERE id = ?').run(id)

    logger.info(`Schedule deleted: ${id}`)
    return { success: true }
  } catch (error) {
    logger.error('Failed to delete schedule', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Duplicates a schedule with all its items
 */
export function duplicateSchedule(id: number): OperationResult {
  try {
    const schedule = getSchedule(id)
    if (!schedule) {
      return { success: false, error: 'Schedule not found' }
    }

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Create new schedule
    const newTitle = `${schedule.title} (Copy)`
    db.query(`
      INSERT INTO schedules (title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(newTitle, schedule.description, now, now)

    const lastId = db.query('SELECT last_insert_rowid() as id').get() as {
      id: number
    }

    // Copy items
    const items = db
      .query(
        'SELECT * FROM schedule_items WHERE schedule_id = ? ORDER BY position',
      )
      .all(id) as ScheduleItem[]

    for (const item of items) {
      db.query(`
        INSERT INTO schedule_items (schedule_id, position, item_type, content_id, content_data, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        lastId.id,
        item.position,
        item.item_type,
        item.content_id,
        item.content_data,
        item.notes,
        now,
        now,
      )
    }

    logger.info(`Schedule duplicated: ${id} -> ${lastId.id}`)
    return { success: true, id: lastId.id }
  } catch (error) {
    logger.error('Failed to duplicate schedule', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Gets a schedule by id
 */
export function getSchedule(id: number): Schedule | null {
  try {
    const db = getDatabase()
    const query = db.query('SELECT * FROM schedules WHERE id = ?')
    return query.get(id) as Schedule | null
  } catch (error) {
    logger.error('Failed to get schedule', error)
    return null
  }
}

/**
 * Gets a schedule with all its items
 */
export function getScheduleWithItems(id: number): ScheduleWithItems | null {
  try {
    const schedule = getSchedule(id)
    if (!schedule) return null

    const db = getDatabase()
    const itemsQuery = db.query(
      'SELECT * FROM schedule_items WHERE schedule_id = ? ORDER BY position',
    )
    const items = itemsQuery.all(id) as ScheduleItem[]

    // Resolve titles for each item
    const resolvedItems: ScheduleItemResolved[] = items.map((item) => {
      let title = 'Untitled'

      switch (item.item_type) {
        case 'song':
          if (item.content_id) {
            const song = getSong(item.content_id)
            if (song) title = song.title
          }
          break
        case 'bible':
          if (item.content_data) {
            const data = JSON.parse(item.content_data)
            title = `${data.book} ${data.chapter}:${data.verseStart}${data.verseEnd ? `-${data.verseEnd}` : ''}`
          }
          break
        case 'text':
          if (item.content_data) {
            const data = JSON.parse(item.content_data)
            title =
              data.title || data.content?.substring(0, 50) || 'Custom Text'
          }
          break
        case 'section':
          if (item.content_data) {
            const data = JSON.parse(item.content_data)
            title = data.title || 'Section'
          }
          break
      }

      return { ...item, title }
    })

    return { ...schedule, items: resolvedItems }
  } catch (error) {
    logger.error('Failed to get schedule with items', error)
    return null
  }
}

/**
 * Gets all schedules
 */
export function getAllSchedules(): Schedule[] {
  try {
    const db = getDatabase()
    const query = db.query('SELECT * FROM schedules ORDER BY updated_at DESC')
    return query.all() as Schedule[]
  } catch (error) {
    logger.error('Failed to get all schedules', error)
    return []
  }
}

/**
 * Adds an item to a schedule
 */
export function addScheduleItem(
  scheduleId: number,
  input: AddScheduleItemInput,
): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Get the next position if not provided
    let position = input.position
    if (position === undefined) {
      const maxPosQuery = db.query(
        'SELECT MAX(position) as maxPos FROM schedule_items WHERE schedule_id = ?',
      )
      const maxPosRow = maxPosQuery.get(scheduleId) as { maxPos: number | null }
      position = (maxPosRow?.maxPos ?? -1) + 1
    }

    const contentData = input.content_data
      ? JSON.stringify(input.content_data)
      : null

    const query = db.query(`
      INSERT INTO schedule_items (schedule_id, position, item_type, content_id, content_data, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    query.run(
      scheduleId,
      position,
      input.item_type,
      input.content_id ?? null,
      contentData,
      input.notes ?? null,
      now,
      now,
    )

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    const lastId = db.query('SELECT last_insert_rowid() as id').get() as {
      id: number
    }
    logger.info(`Schedule item added: ${lastId.id}`)
    return { success: true, id: lastId.id }
  } catch (error) {
    logger.error('Failed to add schedule item', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Updates a schedule item
 */
export function updateScheduleItem(
  scheduleId: number,
  itemId: number,
  input: { notes?: string; content_data?: string },
): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const updates: string[] = []
    const values: (string | number | null)[] = []

    if (input.notes !== undefined) {
      updates.push('notes = ?')
      values.push(input.notes)
    }

    if (input.content_data !== undefined) {
      updates.push('content_data = ?')
      values.push(input.content_data)
    }

    if (updates.length === 0) {
      return { success: true, id: itemId }
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(itemId)
    values.push(scheduleId)

    const query = db.query(`
      UPDATE schedule_items SET ${updates.join(', ')}
      WHERE id = ? AND schedule_id = ?
    `)
    query.run(...values)

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    logger.info(`Schedule item updated: ${itemId}`)
    return { success: true, id: itemId }
  } catch (error) {
    logger.error('Failed to update schedule item', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Removes an item from a schedule
 */
export function removeScheduleItem(
  scheduleId: number,
  itemId: number,
): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    db.query('DELETE FROM schedule_items WHERE id = ? AND schedule_id = ?').run(
      itemId,
      scheduleId,
    )

    // Reorder remaining items
    const items = db
      .query(
        'SELECT id FROM schedule_items WHERE schedule_id = ? ORDER BY position',
      )
      .all(scheduleId) as Array<{ id: number }>
    items.forEach((item, index) => {
      db.query('UPDATE schedule_items SET position = ? WHERE id = ?').run(
        index,
        item.id,
      )
    })

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    logger.info(`Schedule item removed: ${itemId}`)
    return { success: true }
  } catch (error) {
    logger.error('Failed to remove schedule item', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Reorders items within a schedule
 */
export function reorderScheduleItems(
  scheduleId: number,
  input: ReorderItemsInput,
): OperationResult {
  try {
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    for (const item of input.items) {
      db.query(
        'UPDATE schedule_items SET position = ? WHERE id = ? AND schedule_id = ?',
      ).run(item.position, item.id, scheduleId)
    }

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    logger.info(`Schedule items reordered: ${scheduleId}`)
    return { success: true }
  } catch (error) {
    logger.error('Failed to reorder schedule items', error)
    return { success: false, error: String(error) }
  }
}
