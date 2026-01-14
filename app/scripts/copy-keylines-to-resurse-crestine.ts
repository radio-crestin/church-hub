#!/usr/bin/env bun

/**
 * Script to copy keyLines from songs in "BCEV Baicoi" or "Laudele Domnului"
 * to matching songs (by title, case insensitive) in "Resurse Crestine" collection.
 *
 * Run with: bun run scripts/copy-keylines-to-resurse-crestine.ts
 * Debug mode: DEBUG=true bun run scripts/copy-keylines-to-resurse-crestine.ts
 */

import { join } from 'node:path'

import { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  const prefix = {
    debug: '\x1b[90m[DEBUG]\x1b[0m',
    info: '\x1b[36m[INFO]\x1b[0m',
    warning: '\x1b[33m[WARNING]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
  }
  console.log(`${prefix[level]} ${message}`)
}

interface Song {
  id: number
  title: string
  key_line: string | null
  category_id: number | null
}

interface Category {
  id: number
  name: string
}

/**
 * Normalize title for comparison:
 * - Remove diacritics (ăâîșț -> aaist)
 * - Convert to lowercase
 * - Normalize whitespace (multiple spaces -> single space)
 */
function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function copyKeylinesToResurseCrestine(db: Database): void {
  log(
    'info',
    'Starting keyLine copy from BCEV Baicoi/Laudele Domnului to Resurse Crestine...',
  )

  // Get category IDs
  const categories = db
    .query<Category, []>('SELECT id, name FROM song_categories')
    .all()

  const sourceCategoryNames = ['bcev baicoi', 'laudele domnului']
  const targetCategoryName = 'resurse crestine'

  const sourceCategoryIds = categories
    .filter((c) => sourceCategoryNames.includes(c.name.toLowerCase()))
    .map((c) => c.id)

  const targetCategory = categories.find(
    (c) => c.name.toLowerCase() === targetCategoryName,
  )

  if (sourceCategoryIds.length === 0) {
    log(
      'warning',
      'No source categories found (BCEV Baicoi or Laudele Domnului)',
    )
    return
  }

  if (!targetCategory) {
    log('warning', 'Target category "Resurse Crestine" not found')
    return
  }

  log(
    'info',
    `Source categories: ${categories
      .filter((c) => sourceCategoryIds.includes(c.id))
      .map((c) => c.name)
      .join(', ')}`,
  )
  log('info', `Target category: ${targetCategory.name}`)

  db.run('BEGIN TRANSACTION')

  try {
    // Get all songs from source categories that have a keyLine
    const sourceSongs = db
      .query<Song, []>(
        `SELECT id, title, key_line, category_id FROM songs
         WHERE category_id IN (${sourceCategoryIds.join(',')})
         AND key_line IS NOT NULL AND key_line != ''`,
      )
      .all()

    log('info', `Found ${sourceSongs.length} source songs with keyLines`)

    // Get all songs from target category
    const targetSongs = db
      .query<Song, [number]>(
        'SELECT id, title, key_line, category_id FROM songs WHERE category_id = ?',
      )
      .all(targetCategory.id)

    log('info', `Found ${targetSongs.length} songs in Resurse Crestine`)

    // Create a map of normalized titles to target songs for O(1) lookup
    const targetSongsByTitle = new Map<string, Song>()
    for (const song of targetSongs) {
      targetSongsByTitle.set(normalizeTitle(song.title), song)
    }

    let updatedCount = 0
    let skippedExisting = 0
    let skippedNoMatch = 0

    for (const sourceSong of sourceSongs) {
      const targetSong = targetSongsByTitle.get(normalizeTitle(sourceSong.title))

      if (!targetSong) {
        skippedNoMatch++
        log('debug', `No match in Resurse Crestine for: "${sourceSong.title}"`)
        continue
      }

      // Skip if target song already has a keyLine
      if (targetSong.key_line && targetSong.key_line.trim() !== '') {
        skippedExisting++
        log(
          'debug',
          `Target already has keyLine: "${targetSong.title}" - ${targetSong.key_line}`,
        )
        continue
      }

      // Copy keyLine to target song
      db.run(
        'UPDATE songs SET key_line = ?, updated_at = unixepoch() WHERE id = ?',
        [sourceSong.key_line, targetSong.id],
      )

      updatedCount++
      log(
        'debug',
        `Copied keyLine "${sourceSong.key_line}" to "${targetSong.title}" (ID: ${targetSong.id})`,
      )
    }

    db.run('COMMIT')

    console.log('')
    log('info', '\x1b[32m=== Summary ===\x1b[0m')
    log('info', `\x1b[32m✓ Updated: ${updatedCount} songs\x1b[0m`)
    log(
      'info',
      `\x1b[33m○ Skipped (already has keyLine): ${skippedExisting} songs\x1b[0m`,
    )
    log('info', `\x1b[90m○ Skipped (no match): ${skippedNoMatch} songs\x1b[0m`)
  } catch (error) {
    db.run('ROLLBACK')
    log('error', `Failed to copy keylines: ${error}`)
    throw error
  }
}

async function main() {
  // Database path: app/data/app.db (relative to this script at app/scripts/)
  const dbPath = join(import.meta.dir, '..', 'data', 'app.db')

  log('info', `Opening database at: ${dbPath}`)

  const db = new Database(dbPath)

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON')

  try {
    copyKeylinesToResurseCrestine(db)
  } finally {
    db.close()
    log('info', 'Database connection closed')
  }
}

main().catch((err) => {
  console.error('\x1b[31mScript failed:\x1b[0m', err)
  process.exit(1)
})
