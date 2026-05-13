import type { Database } from 'bun:sqlite'
import defaultSongs from '../fixtures/default-songs.json'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-songs:${level}] ${message}`)
}

interface SongSlideFixture {
  content: string
  label: string | null
  sortOrder: number
}

interface SongFixture {
  title: string
  categoryName: string | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
  slides: SongSlideFixture[]
}

/**
 * Seeds default songs from fixture file.
 * Uses title uniqueness to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Add/edit songs in the UI
 * 2. Run: bun run fixtures
 * @throws Error if seeding fails
 */
export function seedSongs(db: Database): void {
  try {
    // Check if songs already exist in database
    const existingCount = db
      .query<{ count: number }, []>('SELECT COUNT(*) as count FROM songs')
      .get()?.count
    if (existingCount && existingCount > 0) {
      log('info', `Songs already seeded (${existingCount} songs), skipping`)
      return
    }

    const songs = defaultSongs as SongFixture[]

    if (!Array.isArray(songs) || songs.length === 0) {
      log('info', 'No songs fixtures available, skipping seed')
      return
    }

    log('info', `Seeding ${songs.length} song(s) from fixtures...`)

    // Build category name to ID mapping
    const categories = db
      .query('SELECT id, name FROM song_categories')
      .all() as Array<{ id: number; name: string }>
    const categoryMap = new Map(categories.map((c) => [c.name, c.id]))

    // Prepared statements + a single transaction collapse ~26k implicit
    // commits into one. On Windows (NTFS + Defender + bun:sqlite fsync)
    // the row-at-a-time version takes >120s and blew our CI smoke test;
    // batched it drops to ~1s. Same speedup applies to a real user's
    // first launch.
    const insertSong = db.prepare(
      `INSERT INTO songs
        (title, category_id, source_filename, author, copyright, ccli, tempo,
         time_signature, theme, alt_theme, hymn_number, key_line, presentation_order,
         presentation_count, last_presented_at, last_manual_edit, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
    )
    const insertSlide = db.prepare(
      `INSERT INTO song_slides
        (song_id, content, label, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
    )
    const findSongByTitle = db.prepare<{ id: number }, [string]>(
      'SELECT id FROM songs WHERE title = ?',
    )

    let seededCount = 0
    const seedAll = db.transaction(() => {
      for (const song of songs) {
        // Skip if already present (idempotent re-runs)
        if (findSongByTitle.get(song.title)) {
          log('debug', `Song already exists: ${song.title}, skipping`)
          continue
        }

        const categoryId = song.categoryName
          ? (categoryMap.get(song.categoryName) ?? null)
          : null

        const result = insertSong.run(
          song.title,
          categoryId,
          song.sourceFilename,
          song.author,
          song.copyright,
          song.ccli,
          song.tempo,
          song.timeSignature,
          song.theme,
          song.altTheme,
          song.hymnNumber,
          song.keyLine,
          song.presentationOrder,
          song.presentationCount,
          song.lastPresentedAt,
          song.lastManualEdit,
        )

        const songId = Number(result.lastInsertRowid)
        if (!songId) {
          throw new Error(
            `[seed-songs] Failed to insert song '${song.title}'. The songs table may be missing required columns (e.g., last_presented_at). Ensure the addLastPresentedAt migration runs before seedSongs.`,
          )
        }

        for (const slide of song.slides) {
          insertSlide.run(songId, slide.content, slide.label, slide.sortOrder)
        }

        seededCount++
      }
    })
    seedAll()

    log('info', `Seeded ${seededCount} song(s) from fixtures`)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during seeding'
    throw new Error(
      `[seed-songs] Failed to seed songs: ${message}. Ensure the 'songs' and 'song_slides' tables exist with correct schema.`,
    )
  }
}
