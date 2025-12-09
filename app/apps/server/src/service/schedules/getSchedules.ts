import type {
  Schedule,
  ScheduleItem,
  ScheduleItemWithSongRecord,
  ScheduleRecord,
  ScheduleWithItems,
} from './types'
import { getDatabase } from '../../db'
import { getSlidesBySongId } from '../songs'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Converts database schedule item record to API format
 */
function toScheduleItem(
  record: ScheduleItemWithSongRecord,
): Omit<ScheduleItem, 'slides'> {
  const isSongItem = record.item_type === 'song' && record.song_id !== null

  return {
    id: record.id,
    scheduleId: record.schedule_id,
    itemType: record.item_type,
    songId: record.song_id,
    song: isSongItem
      ? {
          id: record.song_id!,
          title: record.song_title!,
          categoryName: record.category_name,
        }
      : null,
    slideType: record.slide_type,
    slideContent: record.slide_content,
    sortOrder: record.sort_order,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all schedules with item counts
 */
export function getSchedules(): Schedule[] {
  try {
    log('debug', 'Getting all schedules')

    const db = getDatabase()
    const query = db.query(`
      SELECT
        s.*,
        COUNT(si.id) as item_count,
        SUM(CASE WHEN si.item_type = 'song' THEN 1 ELSE 0 END) as song_count
      FROM schedules s
      LEFT JOIN schedule_items si ON s.id = si.schedule_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `)
    const records = query.all() as Array<
      ScheduleRecord & { item_count: number; song_count: number }
    >

    return records.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      itemCount: record.item_count,
      songCount: record.song_count,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }))
  } catch (error) {
    log('error', `Failed to get schedules: ${error}`)
    return []
  }
}

/**
 * Gets a single schedule by ID with all items
 */
export function getScheduleById(id: number): ScheduleWithItems | null {
  try {
    log('debug', `Getting schedule by ID: ${id}`)

    const db = getDatabase()

    // Get schedule metadata
    const scheduleQuery = db.query('SELECT * FROM schedules WHERE id = ?')
    const schedule = scheduleQuery.get(id) as ScheduleRecord | null

    if (!schedule) {
      log('debug', `Schedule not found: ${id}`)
      return null
    }

    // Get all items for this schedule
    const itemsQuery = db.query(`
      SELECT
        si.*,
        s.title as song_title,
        sc.name as category_name
      FROM schedule_items si
      LEFT JOIN songs s ON si.song_id = s.id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE si.schedule_id = ?
      ORDER BY si.sort_order ASC
    `)
    const itemRecords = itemsQuery.all(id) as ScheduleItemWithSongRecord[]

    // Convert items with slides
    const items: ScheduleItem[] = itemRecords.map((record) => {
      const item = toScheduleItem(record)
      const slides =
        record.item_type === 'song' && record.song_id
          ? getSlidesBySongId(record.song_id)
          : []
      return { ...item, slides }
    })

    const songCount = items.filter((i) => i.itemType === 'song').length

    return {
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      itemCount: items.length,
      songCount,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
      items,
    }
  } catch (error) {
    log('error', `Failed to get schedule: ${error}`)
    return null
  }
}

/**
 * Gets a single schedule item by ID
 */
export function getScheduleItemById(id: number): ScheduleItem | null {
  try {
    log('debug', `Getting schedule item by ID: ${id}`)

    const db = getDatabase()
    const query = db.query(`
      SELECT
        si.*,
        s.title as song_title,
        sc.name as category_name
      FROM schedule_items si
      LEFT JOIN songs s ON si.song_id = s.id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE si.id = ?
    `)
    const record = query.get(id) as ScheduleItemWithSongRecord | null

    if (!record) {
      log('debug', `Schedule item not found: ${id}`)
      return null
    }

    const item = toScheduleItem(record)
    const slides =
      record.item_type === 'song' && record.song_id
        ? getSlidesBySongId(record.song_id)
        : []
    return { ...item, slides }
  } catch (error) {
    log('error', `Failed to get schedule item: ${error}`)
    return null
  }
}
