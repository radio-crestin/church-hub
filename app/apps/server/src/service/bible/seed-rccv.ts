import { importUsfxTranslation } from './import-usfx'
import { getTranslationByAbbreviation, hasTranslations } from './translations'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:seed] ${message}`)
}

const RCCV_URL =
  'https://raw.githubusercontent.com/seven1m/open-bibles/refs/heads/master/ron-rccv.usfx.xml'

/**
 * Seeds the Romanian Corrected Cornilescu Version (RCCV) Bible
 * Only runs if no translations exist in the database
 */
export async function seedRCCV(): Promise<boolean> {
  // Check if any translations already exist
  if (hasTranslations()) {
    log('debug', 'Translations already exist, skipping RCCV seed')
    return false
  }

  // Double check RCCV doesn't exist (in case of partial import)
  const existing = getTranslationByAbbreviation('RCCV')
  if (existing) {
    log('debug', 'RCCV already exists, skipping seed')
    return false
  }

  log('info', 'No Bible translations found, seeding RCCV...')

  try {
    // Fetch the USFX XML from GitHub
    log('info', `Fetching RCCV from ${RCCV_URL}`)
    const response = await fetch(RCCV_URL)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch RCCV: ${response.status} ${response.statusText}`,
      )
    }

    const xmlContent = await response.text()
    log('info', `Downloaded ${xmlContent.length} bytes`)

    // Import the translation
    const result = importUsfxTranslation({
      name: 'Biblia Dumitru Cornilescu Corectată',
      abbreviation: 'RCCV',
      language: 'ro',
      xmlContent,
    })

    if (result.success) {
      log(
        'info',
        `RCCV seeded successfully: ${result.booksImported} books, ${result.versesImported} verses`,
      )
      return true
    }

    log('error', `Failed to seed RCCV: ${result.error}`)
    return false
  } catch (error) {
    log('error', `Error seeding RCCV: ${error}`)
    return false
  }
}

/**
 * Checks if RCCV needs to be seeded and performs the seed if necessary
 * This should be called on server startup
 */
export async function ensureRCCVExists(): Promise<void> {
  try {
    await seedRCCV()
  } catch (error) {
    log('error', `RCCV seed check failed: ${error}`)
  }
}
