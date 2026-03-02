import { asc, eq } from 'drizzle-orm'

import type { SongBookmark } from './types'
import { getDatabase } from '../../db'
import { songBookmarks, songCategories, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

export function getBookmarks(): SongBookmark[] {
  try {
    log('debug', 'Getting song bookmarks')

    const db = getDatabase()
    const records = db
      .select({
        id: songBookmarks.id,
        songId: songBookmarks.songId,
        songTitle: songs.title,
        songCategoryName: songCategories.name,
        songKeyLine: songs.keyLine,
        sortOrder: songBookmarks.sortOrder,
        createdAt: songBookmarks.createdAt,
      })
      .from(songBookmarks)
      .innerJoin(songs, eq(songBookmarks.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .orderBy(asc(songBookmarks.sortOrder))
      .all()

    log('debug', `Found ${records.length} bookmarks`)

    return records.map((r) => ({
      id: r.id,
      songId: r.songId,
      songTitle: r.songTitle,
      songCategoryName: r.songCategoryName,
      songKeyLine: r.songKeyLine,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.getTime(),
    }))
  } catch (error) {
    log('error', `Failed to get bookmarks: ${error}`)
    return []
  }
}
