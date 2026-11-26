import type { PublishedLibrary } from './readPublishedLibrary'
import { slidesFingerprint } from './slidesFingerprint'
import type { Database } from 'bun:sqlite'

/** Library songs per blob, by id range: a song update re-sends one chunk. */
export const SONG_CHUNK = 2000

/** The tables resource blobs carry rows of; nothing else is ever read or written. */
export const RESOURCE_TABLES = ['song_slides', 'bible_books', 'bible_verses']

interface SlideRow {
  song_id: number
  content: string
  label: string | null
  local: number
}

/**
 * The songs whose slides are exactly as a built-in public source publishes
 * them: the song names a file that source publishes, and its slides
 * (content, label, order) match the published version's fingerprint, with
 * no local notes, style overrides or chords. Provenance is checked, never
 * assumed: neither the category nor the edit time decide it, and any local
 * change keeps the song encrypted.
 */
function publishedSongIds(db: Database, published: PublishedLibrary): number[] {
  const files = new Map(
    (
      db
        .query(
          'SELECT id, source_filename FROM songs WHERE source_filename IS NOT NULL',
        )
        .all() as { id: number; source_filename: string }[]
    )
      .filter((song) => published.has(song.source_filename))
      .map((song) => [song.id, song.source_filename]),
  )
  const slides = new Map<number, SlideRow[]>()
  for (const row of db
    .query(
      `SELECT song_id, content, label,
         (notes IS NOT NULL OR style_overrides IS NOT NULL OR chords IS NOT NULL) AS local
       FROM song_slides ORDER BY song_id, sort_order, id`,
    )
    .all() as SlideRow[]) {
    if (!files.has(row.song_id)) continue
    slides.set(row.song_id, [...(slides.get(row.song_id) ?? []), row])
  }
  return [...slides]
    .filter(
      ([songId, rows]) =>
        rows.every((row) => !row.local) &&
        published
          .get(files.get(songId) as string)
          ?.has(slidesFingerprint(rows)),
    )
    .map(([songId]) => songId)
    .sort((a, b) => a - b)
}

/**
 * What goes into plaintext resource blobs, decided per row:
 * - Bible books and verses of every translation (public texts; the
 *   translation's own row, which names its source file, stays in the user
 *   part);
 * - the slides of songs exactly as a built-in public source publishes them
 *   (publishedSongIds). Private link subscriptions are never shared.
 * Everything else, every songs row included (it holds how often and when
 * the church sang it), stays in the encrypted user part. When unsure, a row
 * is the church's.
 */
export function planResources(db: Database, published: PublishedLibrary) {
  const songIds = publishedSongIds(db, published)
  const translationIds = (
    db.query('SELECT id FROM bible_translations ORDER BY id').all() as {
      id: number
    }[]
  ).map((row) => row.id)
  return { songIds, translationIds }
}

export type ResourcePlan = ReturnType<typeof planResources>
