import { getRawDatabase } from '../../db/connection'
import { seedDefaultScreens } from '../../db/migrations/seed-screens'
import { seedAppSettings } from '../../db/migrations/seed-settings'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: service logging
  console.log(`[factory-reset:${level}] ${message}`)
}

export interface FactoryResetResult {
  success: boolean
  message: string
  error?: string
}

/**
 * Performs a factory reset by clearing configuration tables and re-seeding defaults.
 *
 * Resets:
 * - Screens (screen_content_configs, screen_next_slide_configs, screens)
 * - App settings
 *
 * Preserves:
 * - Songs and song categories (user content)
 * - Bible translations (user content)
 * - Users and permissions
 */
export function performFactoryReset(): FactoryResetResult {
  const db = getRawDatabase()

  try {
    log('info', 'Starting factory reset...')

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

    // Re-seed defaults
    log('debug', 'Re-seeding default screens...')
    seedDefaultScreens(db)

    log('debug', 'Re-seeding default settings...')
    seedAppSettings(db)

    // Commit transaction
    db.run('COMMIT')

    log('info', 'Factory reset completed successfully')

    return {
      success: true,
      message:
        'Factory reset completed. Application settings and screens have been restored to defaults.',
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
