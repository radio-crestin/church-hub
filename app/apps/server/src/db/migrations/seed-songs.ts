import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'

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
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  slides: SongSlideFixture[]
}

const FIXTURE_PATH = join(import.meta.dir, '../fixtures/default-songs.json')

/**
 * Seeds default songs from fixture file.
 * Uses title uniqueness to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Add/edit songs in the UI
 * 2. Run: bun run fixtures
 */
export function seedSongs(db: Database): void {
  log('debug', 'Checking if songs fixture exists...')

  if (!existsSync(FIXTURE_PATH)) {
    log('debug', 'No songs fixture found, skipping seed')
    return
  }

  const songs = require(FIXTURE_PATH) as SongFixture[]

  if (!Array.isArray(songs) || songs.length === 0) {
    log('debug', 'Songs fixture is empty, skipping seed')
    return
  }

  log('info', 'Seeding songs from fixtures...')

  // Build category name to ID mapping
  const categories = db
    .query('SELECT id, name FROM song_categories')
    .all() as Array<{ id: number; name: string }>
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]))

  let seededCount = 0

  for (const song of songs) {
    // Check if song already exists
    const existing = db
      .query('SELECT id FROM songs WHERE title = ?')
      .get(song.title) as { id: number } | null

    if (existing) {
      log('debug', `Song already exists: ${song.title}, skipping`)
      continue
    }

    // Resolve category ID from name
    const categoryId = song.categoryName
      ? (categoryMap.get(song.categoryName) ?? null)
      : null

    // Insert song
    db.run(
      `INSERT INTO songs
        (title, category_id, source_filename, author, copyright, ccli, key, tempo,
         time_signature, theme, alt_theme, hymn_number, key_line, presentation_order,
         presentation_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      [
        song.title,
        categoryId,
        song.sourceFilename,
        song.author,
        song.copyright,
        song.ccli,
        song.key,
        song.tempo,
        song.timeSignature,
        song.theme,
        song.altTheme,
        song.hymnNumber,
        song.keyLine,
        song.presentationOrder,
        song.presentationCount,
      ],
    )

    // Get the inserted song ID
    const inserted = db
      .query('SELECT id FROM songs WHERE title = ?')
      .get(song.title) as { id: number } | null

    if (inserted && song.slides.length > 0) {
      // Insert slides
      for (const slide of song.slides) {
        db.run(
          `INSERT INTO song_slides
            (song_id, content, label, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
          [inserted.id, slide.content, slide.label, slide.sortOrder],
        )
      }
      log(
        'debug',
        `Seeded song: ${song.title} with ${song.slides.length} slides`,
      )
    } else {
      log('debug', `Seeded song: ${song.title}`)
    }

    seededCount++
  }

  log('info', `Seeded ${seededCount} song(s) from fixtures`)
}
