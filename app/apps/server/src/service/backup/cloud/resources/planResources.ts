import type { Database } from 'bun:sqlite'
import { BUILT_IN_SONG_SOURCES } from '../../../song-sources'

/** Library songs per blob, by id range: a song update re-sends one chunk. */
export const SONG_CHUNK = 2000

/** The tables resource blobs carry rows of; nothing else is ever read or written. */
export const RESOURCE_TABLES = ['song_slides', 'bible_books', 'bible_verses']

/**
 * What goes into plaintext resource blobs, decided per row:
 * - Bible books and verses of every translation (public texts; the
 *   translation's own row, which names its source file, stays in the user
 *   part);
 * - the slides of library songs: songs in a song source's category (built
 *   in, or a subscribed link) never edited on this PC and with no slide
 *   notes or style overrides.
 * Everything else, every songs row included (it holds how often and when
 * the church sang it), stays in the encrypted user part. When unsure, a row
 * is the church's.
 */
export function planResources(db: Database) {
  const linkCategories = (() => {
    try {
      return (
        db
          .query('SELECT category_name FROM song_source_subscriptions')
          .all() as {
          category_name: string
        }[]
      ).map((row) => row.category_name)
    } catch {
      return []
    }
  })()
  const categories = [
    ...new Set([
      ...BUILT_IN_SONG_SOURCES.map((s) => s.categoryName),
      ...linkCategories,
    ]),
  ]
  const marks = categories.map(() => '?').join(',')
  const songIds = (
    db
      .query(
        `SELECT s.id FROM songs s JOIN song_categories c ON c.id = s.category_id
         WHERE c.name IN (${marks}) AND s.last_manual_edit IS NULL
           AND NOT EXISTS (SELECT 1 FROM song_slides sl WHERE sl.song_id = s.id
             AND (sl.notes IS NOT NULL OR sl.style_overrides IS NOT NULL))
         ORDER BY s.id`,
      )
      .all(...categories) as { id: number }[]
  ).map((row) => row.id)
  const translationIds = (
    db.query('SELECT id FROM bible_translations ORDER BY id').all() as {
      id: number
    }[]
  ).map((row) => row.id)
  return { songIds, translationIds }
}

export type ResourcePlan = ReturnType<typeof planResources>
