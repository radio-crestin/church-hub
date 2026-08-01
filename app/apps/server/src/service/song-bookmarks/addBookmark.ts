import { eq, sql } from 'drizzle-orm'

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

export function addBookmark(
  songId: number,
): { data: SongBookmark } | { error: string } {
  try {
    log('debug', `Adding bookmark for song ${songId}`)

    const db = getDatabase()

    const songTagNames = (getTagsBySongIds([songId]).get(songId) ?? []).map(
      (t) => t.name,
    )

    // No duplicate check: the same song may legitimately appear several times
    // in a service, so every add creates its own row.
    // Get max sort order
    const maxOrder = db
      .select({ max: sql<number>`MAX(sort_order)` })
      .from(songBookmarks)
      .get()

    const inserted = db
      .insert(songBookmarks)
      .values({
        songId,
        sortOrder: (maxOrder?.max ?? -1) + 1,
      })
      .returning()
      .get()

    const song = db
      .select({
        title: songs.title,
        categoryName: songCategories.name,
        keyLine: songs.keyLine,
      })
      .from(songs)
      .leftJoin(songCategories, eq(songs.categoryId, songCategories.id))
      .where(eq(songs.id, songId))
      .get()

    log('info', `Song ${songId} bookmarked: ${inserted.id}`)

    return {
      data: {
        id: inserted.id,
        songId: inserted.songId,
        songTitle: song?.title ?? '',
        songCategoryName: song?.categoryName ?? null,
        songKeyLine: song?.keyLine ?? null,
        songTagNames,
        sortOrder: inserted.sortOrder,
        createdAt: inserted.createdAt.getTime(),
      },
    }
  } catch (error) {
    log('error', `Failed to add bookmark: ${error}`)
    return { error: String(error) }
  }
}
