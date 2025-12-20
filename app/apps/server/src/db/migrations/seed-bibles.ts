import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-bibles:${level}] ${message}`)
}

interface BibleTranslationFixture {
  name: string
  abbreviation: string
  language: string
  sourceFilename: string | null
}

const FIXTURE_PATH = join(import.meta.dir, '../fixtures/default-bibles.json')

/**
 * Seeds default bible translations metadata from fixture file.
 * Uses abbreviation uniqueness to avoid duplicates on subsequent runs.
 *
 * Note: This only seeds the translation metadata, not the actual verses.
 * Bible verses are imported separately via the import functionality.
 *
 * To update fixtures:
 * 1. Import bibles in the UI
 * 2. Run: bun run fixtures
 */
export function seedBibleTranslations(db: Database): void {
  log('debug', 'Checking if bibles fixture exists...')

  if (!existsSync(FIXTURE_PATH)) {
    log('debug', 'No bibles fixture found, skipping seed')
    return
  }

  const translations = require(FIXTURE_PATH) as BibleTranslationFixture[]

  if (!Array.isArray(translations) || translations.length === 0) {
    log('debug', 'Bibles fixture is empty, skipping seed')
    return
  }

  log('info', 'Seeding bible translations from fixtures...')

  let seededCount = 0

  for (const translation of translations) {
    // Check if translation already exists
    const existing = db
      .query('SELECT id FROM bible_translations WHERE abbreviation = ?')
      .get(translation.abbreviation) as { id: number } | null

    if (existing) {
      log(
        'debug',
        `Bible translation already exists: ${translation.abbreviation}, skipping`,
      )
      continue
    }

    db.run(
      `INSERT INTO bible_translations
        (name, abbreviation, language, source_filename, created_at, updated_at)
        VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
      [
        translation.name,
        translation.abbreviation,
        translation.language,
        translation.sourceFilename,
      ],
    )

    log('debug', `Seeded bible translation: ${translation.name}`)
    seededCount++
  }

  log('info', `Seeded ${seededCount} bible translation(s) from fixtures`)
}
