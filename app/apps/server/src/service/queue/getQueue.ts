import { asc, eq } from 'drizzle-orm'

import type { QueueItem } from './types'
import { getDatabase } from '../../db'
import { presentationQueue, songCategories, songs } from '../../db/schema'
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
  record: typeof presentationQueue.$inferSelect & {
    song: typeof songs.$inferSelect | null
    songCategory: typeof songCategories.$inferSelect | null
  },
): Omit<QueueItem, 'slides'> {
  const isSongItem = record.itemType === 'song' && record.songId !== null

  return {
    id: record.id,
    itemType: record.itemType,
    songId: record.songId,
    song:
      isSongItem && record.song
        ? {
            id: record.song.id,
            title: record.song.title,
            categoryName: record.songCategory?.name ?? null,
          }
        : null,
    slideType: record.slideType,
    slideContent: record.slideContent,
    sortOrder: record.sortOrder,
    isExpanded: record.isExpanded,
    createdAt:
      record.createdAt instanceof Date
        ? Math.floor(record.createdAt.getTime() / 1000)
        : (record.createdAt as unknown as number),
    updatedAt:
      record.updatedAt instanceof Date
        ? Math.floor(record.updatedAt.getTime() / 1000)
        : (record.updatedAt as unknown as number),
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
    const records = db
      .select({
        presentationQueue,
        song: songs,
        songCategory: songCategories,
      })
      .from(presentationQueue)
      .leftJoin(songs, eq(presentationQueue.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .orderBy(asc(presentationQueue.sortOrder))
      .all()

    // Get slides for each queue item
    return records.map((record) => {
      const item = toQueueItem({
        ...record.presentationQueue,
        song: record.song,
        songCategory: record.songCategory,
      })
      // Only fetch slides for song items
      const slides =
        record.presentationQueue.itemType === 'song' &&
        record.presentationQueue.songId
          ? getSlidesBySongId(record.presentationQueue.songId)
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
    const record = db
      .select({
        presentationQueue,
        song: songs,
        songCategory: songCategories,
      })
      .from(presentationQueue)
      .leftJoin(songs, eq(presentationQueue.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .where(eq(presentationQueue.id, id))
      .get()

    if (!record) {
      log('debug', `Queue item not found: ${id}`)
      return null
    }

    const item = toQueueItem({
      ...record.presentationQueue,
      song: record.song,
      songCategory: record.songCategory,
    })
    // Only fetch slides for song items
    const slides =
      record.presentationQueue.itemType === 'song' &&
      record.presentationQueue.songId
        ? getSlidesBySongId(record.presentationQueue.songId)
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
