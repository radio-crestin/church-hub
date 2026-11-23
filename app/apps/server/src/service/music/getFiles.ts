import { and, asc, desc, eq, isNotNull, like, or, sql } from 'drizzle-orm'

import { toMusicFile } from './toMusicFile'
import type { GetFilesInput, MusicFile } from './types'
import { getDatabase } from '../../db'
import { musicFiles } from '../../db/schema'

/**
 * The library's tracks, by title; `recent` keeps only the played ones, the
 * last played first. `search` matches the title, artist, album or file name.
 */
export function getFiles(input: GetFilesInput = {}): MusicFile[] {
  const db = getDatabase()

  const conditions = []

  if (input.folderId) {
    conditions.push(eq(musicFiles.folderId, input.folderId))
  }

  if (input.recent) {
    conditions.push(isNotNull(musicFiles.lastPlayedAt))
  }

  if (input.format) {
    conditions.push(eq(musicFiles.format, input.format))
  }

  if (input.artist) {
    conditions.push(like(musicFiles.artist, `%${input.artist}%`))
  }

  if (input.album) {
    conditions.push(like(musicFiles.album, `%${input.album}%`))
  }

  if (input.search) {
    const searchPattern = `%${input.search}%`
    conditions.push(
      or(
        like(musicFiles.title, searchPattern),
        like(musicFiles.artist, searchPattern),
        like(musicFiles.album, searchPattern),
        like(musicFiles.filename, searchPattern),
      ),
    )
  }

  let query = db
    .select()
    .from(musicFiles)
    .orderBy(
      input.recent
        ? desc(musicFiles.lastPlayedAt)
        : asc(
            sql`coalesce(${musicFiles.title}, ${musicFiles.filename}) collate nocase`,
          ),
    )

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query
  }

  if (input.limit) {
    query = query.limit(input.limit) as typeof query
  }

  if (input.offset) {
    query = query.offset(input.offset) as typeof query
  }

  return query.all().map(toMusicFile)
}

export function getFileById(id: number): MusicFile | null {
  const db = getDatabase()

  const row = db.select().from(musicFiles).where(eq(musicFiles.id, id)).get()

  return row ? toMusicFile(row) : null
}
