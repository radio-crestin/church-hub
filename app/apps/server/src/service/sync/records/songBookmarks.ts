import { idByUuid } from './idByUuid'
import { getRawDatabase } from '../../../db'
import { createLogger } from '../../../utils/logger'
import type { LibrarySongBookmark } from '../types'

const logger = createLogger('sync')

export function serializeSongBookmarks(): LibrarySongBookmark[] {
  return getRawDatabase()
    .query<LibrarySongBookmark, []>(
      `SELECT b.uuid, s.uuid AS songUuid, s.title AS songTitle, b.sort_order AS sortOrder,
              b.is_sung AS isSung, b.sung_at AS sungAt,
              b.created_at AS createdAt, b.updated_at AS updatedAt
         FROM song_bookmarks b JOIN songs s ON s.id = b.song_id
        WHERE b.uuid != ''`,
    )
    .all()
}

export function upsertSongBookmark(
  bookmark: LibrarySongBookmark,
): number | null {
  const songId = idByUuid('songs', bookmark.songUuid)
  if (songId === null) {
    logger.warning(
      `Song bookmark ${bookmark.uuid}: song ${bookmark.songUuid} missing locally, left out`,
    )
    return null
  }
  getRawDatabase()
    .query(
      `INSERT INTO song_bookmarks (uuid, song_id, sort_order, is_sung, sung_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET
         song_id = excluded.song_id, sort_order = excluded.sort_order,
         is_sung = excluded.is_sung, sung_at = excluded.sung_at,
         updated_at = excluded.updated_at`,
    )
    .run(
      bookmark.uuid,
      songId,
      bookmark.sortOrder,
      bookmark.isSung,
      bookmark.sungAt,
      bookmark.createdAt,
      bookmark.updatedAt,
    )
  return idByUuid('song_bookmarks', bookmark.uuid)
}
