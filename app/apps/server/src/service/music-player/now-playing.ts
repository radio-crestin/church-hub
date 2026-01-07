import { asc, eq } from 'drizzle-orm'

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
  const db = getDatabase()

  const maxSortOrder = db
    .select({ sortOrder: musicNowPlaying.sortOrder })
    .from(musicNowPlaying)
    .orderBy(asc(musicNowPlaying.sortOrder))
    .all()
    .pop()

  let nextSortOrder = (maxSortOrder?.sortOrder ?? -1) + 1

  for (const fileId of fileIds) {
    db.insert(musicNowPlaying)
      .values({
        fileId,
        sortOrder: nextSortOrder,
      })
      .run()
    nextSortOrder++
  }
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

  for (let i = 0; i < fileIds.length; i++) {
    db.insert(musicNowPlaying)
      .values({
        fileId: fileIds[i],
        sortOrder: i,
      })
      .run()
  }
}

export function reorderNowPlaying(itemIds: number[]): void {
  const db = getDatabase()

  for (let i = 0; i < itemIds.length; i++) {
    db.update(musicNowPlaying)
      .set({ sortOrder: i })
      .where(eq(musicNowPlaying.id, itemIds[i]))
      .run()
  }
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
