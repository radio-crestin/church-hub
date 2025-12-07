import type { QueueItem, QueueItemWithSongRecord } from './types'
import { getDatabase } from '../../db'
import { getSlidesBySongId } from '../songs'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Converts database queue item record to API format
 * Handles both song items and standalone slide items
 */
function toQueueItem(
  record: QueueItemWithSongRecord,
): Omit<QueueItem, 'slides'> {
  const isSongItem = record.item_type === 'song' && record.song_id !== null

  return {
    id: record.id,
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
    isExpanded: record.is_expanded === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * Gets all queue items with song data and slides
 * Supports both song items and standalone slide items
 */
export function getQueue(): QueueItem[] {
  try {
    log('debug', 'Getting all queue items')

    const db = getDatabase()
    const query = db.query(`
      SELECT
        pq.*,
        s.title as song_title,
        sc.name as category_name
      FROM presentation_queue pq
      LEFT JOIN songs s ON pq.song_id = s.id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      ORDER BY pq.sort_order ASC
    `)
    const records = query.all() as QueueItemWithSongRecord[]

    // Get slides for each queue item
    return records.map((record) => {
      const item = toQueueItem(record)
      // Only fetch slides for song items
      const slides =
        record.item_type === 'song' && record.song_id
          ? getSlidesBySongId(record.song_id)
          : []
      return {
        ...item,
        slides,
      }
    })
  } catch (error) {
    log('error', `Failed to get queue: ${error}`)
    return []
  }
}

/**
 * Gets a single queue item by ID
 */
export function getQueueItemById(id: number): QueueItem | null {
  try {
    log('debug', `Getting queue item by ID: ${id}`)

    const db = getDatabase()
    const query = db.query(`
      SELECT
        pq.*,
        s.title as song_title,
        sc.name as category_name
      FROM presentation_queue pq
      LEFT JOIN songs s ON pq.song_id = s.id
      LEFT JOIN song_categories sc ON s.category_id = sc.id
      WHERE pq.id = ?
    `)
    const record = query.get(id) as QueueItemWithSongRecord | null

    if (!record) {
      log('debug', `Queue item not found: ${id}`)
      return null
    }

    const item = toQueueItem(record)
    // Only fetch slides for song items
    const slides =
      record.item_type === 'song' && record.song_id
        ? getSlidesBySongId(record.song_id)
        : []
    return {
      ...item,
      slides,
    }
  } catch (error) {
    log('error', `Failed to get queue item: ${error}`)
    return null
  }
}
