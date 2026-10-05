import { asc, eq, inArray } from 'drizzle-orm'

import { loadSongLookup } from './loadSongLookup'
import { parseSongBookmarksText } from './parseSongBookmarksText'
import type { SongBookmarksTextResult } from './types'
import { getDatabase } from '../../db'
import { songBookmarkNotes, songBookmarks } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [song-bookmarks] ${message}`)
}

/**
 * Makes the song Marcaje list exactly what the text says, in its order.
 *
 * All or nothing: when any song line cannot be matched, nothing changes and
 * every such line comes back with its number, so the operator never loses
 * part of the list to a typo.
 *
 * A song already in the list keeps its row, so its "already sung" mark
 * survives the edit; the same goes for a note with unchanged text.
 */
export function replaceBookmarksFromText(
  text: string,
): SongBookmarksTextResult {
  const entries = parseSongBookmarksText(text)
  const lookup = loadSongLookup()

  const errors: SongBookmarksTextResult['errors'] = []
  const resolved = entries.map((entry) => {
    if (entry.kind === 'note') return entry
    const songId =
      entry.songId !== undefined
        ? lookup.byId.has(entry.songId)
          ? entry.songId
          : undefined
        : lookup.byTitle(entry.title)
    if (songId === undefined) {
      errors.push({
        line: entry.line,
        content: entry.content,
        reason: 'song_not_found',
      })
    }
    return { ...entry, songId }
  })

  const songCount = resolved.filter((entry) => entry.kind === 'song').length
  const noteCount = resolved.length - songCount

  if (errors.length > 0) {
    log('info', `Marcaje text not applied: ${errors.length} unknown songs`)
    return { applied: false, songs: songCount, notes: noteCount, errors }
  }

  const db = getDatabase()
  db.transaction((tx) => {
    const bookmarkRows = tx
      .select({ id: songBookmarks.id, songId: songBookmarks.songId })
      .from(songBookmarks)
      .orderBy(asc(songBookmarks.sortOrder))
      .all()
    const noteRows = tx
      .select({ id: songBookmarkNotes.id, content: songBookmarkNotes.content })
      .from(songBookmarkNotes)
      .orderBy(asc(songBookmarkNotes.sortOrder))
      .all()

    const keptBookmarks = new Set<number>()
    const keptNotes = new Set<number>()

    resolved.forEach((entry, sortOrder) => {
      if (entry.kind === 'note') {
        const reuse = noteRows.find(
          (row) => row.content === entry.content && !keptNotes.has(row.id),
        )
        if (reuse) {
          keptNotes.add(reuse.id)
          tx.update(songBookmarkNotes)
            .set({ sortOrder })
            .where(eq(songBookmarkNotes.id, reuse.id))
            .run()
        } else {
          tx.insert(songBookmarkNotes)
            .values({ content: entry.content, sortOrder })
            .run()
        }
        return
      }

      const songId = entry.songId as number
      const reuse = bookmarkRows.find(
        (row) => row.songId === songId && !keptBookmarks.has(row.id),
      )
      if (reuse) {
        keptBookmarks.add(reuse.id)
        tx.update(songBookmarks)
          .set({ sortOrder })
          .where(eq(songBookmarks.id, reuse.id))
          .run()
      } else {
        tx.insert(songBookmarks).values({ songId, sortOrder }).run()
      }
    })

    const droppedBookmarks = bookmarkRows
      .map((row) => row.id)
      .filter((id) => !keptBookmarks.has(id))
    const droppedNotes = noteRows
      .map((row) => row.id)
      .filter((id) => !keptNotes.has(id))
    if (droppedBookmarks.length > 0) {
      tx.delete(songBookmarks)
        .where(inArray(songBookmarks.id, droppedBookmarks))
        .run()
    }
    if (droppedNotes.length > 0) {
      tx.delete(songBookmarkNotes)
        .where(inArray(songBookmarkNotes.id, droppedNotes))
        .run()
    }
  })

  log(
    'info',
    `Marcaje replaced from text: ${songCount} songs, ${noteCount} notes`,
  )
  return { applied: true, songs: songCount, notes: noteCount, errors: [] }
}
