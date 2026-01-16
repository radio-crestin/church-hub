import { asc, eq, sql } from 'drizzle-orm'

import type { NowPlayingItem } from './types'
import { getDatabase } from '../../db'
import { musicFiles, musicNowPlaying } from '../../db/schema'

export function getNowPlayingQueue(): NowPlayingItem[] {
  const db = getDatabase()

  const rows = db
    .select({
      item: musicNowPlaying,
      file: {
        id: musicFiles.id,
        path: musicFiles.path,
        filename: musicFiles.filename,
        title: musicFiles.title,
        artist: musicFiles.artist,
        album: musicFiles.album,
        duration: musicFiles.duration,
      },
    })
    .from(musicNowPlaying)
    .innerJoin(musicFiles, eq(musicNowPlaying.fileId, musicFiles.id))
    .orderBy(asc(musicNowPlaying.sortOrder))
    .all()

  return rows.map((row) => ({
    id: row.item.id,
    fileId: row.item.fileId,
    sortOrder: row.item.sortOrder,
    createdAt: row.item.createdAt,
    file: row.file,
  }))
}

export function clearNowPlayingQueue(): void {
  const db = getDatabase()
  db.delete(musicNowPlaying).run()
}

export function addToNowPlaying(fileId: number): number {
  const db = getDatabase()

  const maxSortOrder = db
    .select({ sortOrder: musicNowPlaying.sortOrder })
    .from(musicNowPlaying)
    .orderBy(asc(musicNowPlaying.sortOrder))
    .all()
    .pop()

  const nextSortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

  const result = db
    .insert(musicNowPlaying)
    .values({
      fileId,
      sortOrder: nextSortOrder,
    })
    .returning({ id: musicNowPlaying.id })
    .get()

  return result.id
}

export function addMultipleToNowPlaying(fileIds: number[]): void {
  if (fileIds.length === 0) return

  const db = getDatabase()

  const maxSortOrder = db
    .select({ sortOrder: musicNowPlaying.sortOrder })
    .from(musicNowPlaying)
    .orderBy(asc(musicNowPlaying.sortOrder))
    .all()
    .pop()

  const startSortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

  // Batch insert all items in a single query
  const values = fileIds.map((fileId, index) => ({
    fileId,
    sortOrder: startSortOrder + index,
  }))

  db.insert(musicNowPlaying).values(values).run()
}

export function removeFromNowPlaying(itemId: number): boolean {
  const db = getDatabase()

  const result = db
    .delete(musicNowPlaying)
    .where(eq(musicNowPlaying.id, itemId))
    .run()

  return result.changes > 0
}

export function setNowPlayingQueue(fileIds: number[]): void {
  const db = getDatabase()

  db.delete(musicNowPlaying).run()

  if (fileIds.length === 0) return

  // Batch insert all items in a single query
  const values = fileIds.map((fileId, index) => ({
    fileId,
    sortOrder: index,
  }))

  db.insert(musicNowPlaying).values(values).run()
}

export function reorderNowPlaying(itemIds: number[]): void {
  if (itemIds.length === 0) return

  const db = getDatabase()

  // Build a single UPDATE with CASE for all items (batch operation)
  // This reduces N queries to 1 query
  const caseParts = itemIds
    .map((id, index) => `WHEN ${id} THEN ${index}`)
    .join(' ')
  const idList = itemIds.join(',')

  db.run(
    sql.raw(`
    UPDATE music_now_playing
    SET sort_order = CASE id ${caseParts} END
    WHERE id IN (${idList})
  `),
  )
}

export function getQueueItemAtIndex(index: number): NowPlayingItem | null {
  const db = getDatabase()

  const row = db
    .select({
      item: musicNowPlaying,
      file: {
        id: musicFiles.id,
        path: musicFiles.path,
        filename: musicFiles.filename,
        title: musicFiles.title,
        artist: musicFiles.artist,
        album: musicFiles.album,
        duration: musicFiles.duration,
      },
    })
    .from(musicNowPlaying)
    .innerJoin(musicFiles, eq(musicNowPlaying.fileId, musicFiles.id))
    .orderBy(asc(musicNowPlaying.sortOrder))
    .limit(1)
    .offset(index)
    .get()

  if (!row) return null

  return {
    id: row.item.id,
    fileId: row.item.fileId,
    sortOrder: row.item.sortOrder,
    createdAt: row.item.createdAt,
    file: row.file,
  }
}

export function getQueueLength(): number {
  const db = getDatabase()

  const result = db
    .select({ id: musicNowPlaying.id })
    .from(musicNowPlaying)
    .all()

  return result.length
}
