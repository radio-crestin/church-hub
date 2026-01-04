import { getRawDatabase } from '../../db/connection'
import { seedBibleTranslations } from '../../db/migrations/seed-bibles'
import { seedDefaultScreens } from '../../db/migrations/seed-screens'
import { seedAppSettings } from '../../db/migrations/seed-settings'
import { seedSongCategories } from '../../db/migrations/seed-song-categories'
import { seedSongs } from '../../db/migrations/seed-songs'
import { rebuildSearchIndex as rebuildBibleSearchIndex } from '../bible/search'
import { rebuildSearchIndex } from '../songs/search'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: service logging
  console.log(`[factory-reset:${level}] ${message}`)
}

export interface FactoryResetOptions {
  /** Reset Bible translations to default fixtures (default: false) */
  includeBibles?: boolean
  /** Reset songs and categories to default fixtures (default: false) */
  includeSongs?: boolean
}

export interface FactoryResetResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Performs a factory reset by clearing configuration tables and re-seeding defaults.
 *
 * Always resets:
 * - Screens (screen_content_configs, screen_next_slide_configs, screens)
 * - App settings
 *
 * Optionally resets (via options):
 * - Bible translations (includeBibles: true)
 * - Songs and song categories (includeSongs: true)
 *
 * Always preserves:
 * - Users and permissions
 */
export function performFactoryReset(
  options: FactoryResetOptions = {},
): FactoryResetResult {
  const { includeBibles = false, includeSongs = false } = options
  const db = getRawDatabase()

  try {
    log(
      'info',
      `Starting factory reset... (includeBibles: ${includeBibles}, includeSongs: ${includeSongs})`,
    )

    // Start transaction for atomicity
    db.run('BEGIN TRANSACTION')

    // Clear screen-related tables (order matters due to foreign keys)
    log('debug', 'Clearing screen_content_configs...')
    db.run('DELETE FROM screen_content_configs')

    log('debug', 'Clearing screen_next_slide_configs...')
    db.run('DELETE FROM screen_next_slide_configs')

    log('debug', 'Clearing screens...')
    db.run('DELETE FROM screens')

    // Clear app settings
    log('debug', 'Clearing app_settings...')
    db.run('DELETE FROM app_settings')

    // Optionally clear and reseed Bible translations
    if (includeBibles) {
      log('info', 'Clearing Bible translations...')
      db.run('DELETE FROM bible_verses')
      db.run('DELETE FROM bible_books')
      db.run('DELETE FROM bible_translations')
    }

    // Optionally clear and reseed songs
    if (includeSongs) {
      log('info', 'Clearing songs and categories...')
      db.run('DELETE FROM song_slides')
      db.run('DELETE FROM songs')
      db.run('DELETE FROM song_categories')
    }

    // Re-seed defaults
    log('debug', 'Re-seeding default screens...')
    seedDefaultScreens(db)

    log('debug', 'Re-seeding default settings...')
    seedAppSettings(db)

    if (includeSongs) {
      log('info', 'Re-seeding default song categories...')
      seedSongCategories(db)
      log('info', 'Re-seeding default songs...')
      seedSongs(db)
    }

    if (includeBibles) {
      log('info', 'Re-seeding default Bible translations...')
      seedBibleTranslations(db)
    }

    // Commit transaction
    db.run('COMMIT')

    // Rebuild FTS search indexes after transaction commits
    if (includeSongs) {
      log('info', 'Rebuilding song search index after reset...')
      rebuildSearchIndex()
    }
    if (includeBibles) {
      log('info', 'Rebuilding Bible search index after reset...')
      rebuildBibleSearchIndex()
    }

    log('info', 'Factory reset completed successfully')

    const resetItems = ['screens', 'settings']
    if (includeBibles) resetItems.push('Bible translations')
    if (includeSongs) resetItems.push('songs')

    return {
      success: true,
      message: `Factory reset completed. Restored defaults for: ${resetItems.join(', ')}.`,
    }
  } catch (error) {
    // Rollback on error
    try {
      db.run('ROLLBACK')
    } catch {
      // Ignore rollback errors
    }

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    log('error', `Factory reset failed: ${errorMessage}`)

    return {
      success: false,
      message: 'Factory reset failed',
      error: errorMessage,
    }
  }
}
