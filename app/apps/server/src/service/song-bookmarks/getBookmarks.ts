import { asc, eq } from 'drizzle-orm'

import type { SongBookmark } from './types'
import { getDatabase } from '../../db'
import { songBookmarks, songCategories, songs } from '../../db/schema'
import { getTagsBySongIds } from '../songs/tags'

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
        isSung: songBookmarks.isSung,
        sungAt: songBookmarks.sungAt,
        createdAt: songBookmarks.createdAt,
      })
      .from(songBookmarks)
      .innerJoin(songs, eq(songBookmarks.songId, songs.id))
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .orderBy(asc(songBookmarks.sortOrder))
      .all()

    log('debug', `Found ${records.length} bookmarks`)

    // Bulk-fetch tags for all bookmarked songs in a single query (no N+1).
    const tagsBySongId = getTagsBySongIds(records.map((r) => r.songId))

    return records.map((r) => ({
      id: r.id,
      songId: r.songId,
      songTitle: r.songTitle,
      songCategoryName: r.songCategoryName,
      songKeyLine: r.songKeyLine,
      songTagNames: (tagsBySongId.get(r.songId) ?? []).map((t) => t.name),
      sortOrder: r.sortOrder,
      isSung: r.isSung,
      sungAt: r.sungAt ? r.sungAt.getTime() : null,
      createdAt: r.createdAt.getTime(),
    }))
  } catch (error) {
    log('error', `Failed to get bookmarks: ${error}`)
    return []
  }
}
