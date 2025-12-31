import { importBibleTranslation } from './import'
import { getTranslationByAbbreviation, hasTranslations } from './translations'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:seed] ${message}`)
}

// Romanian Cornilescu Bible in OSIS format from Holy-Bible-XML-Format
const CORNILESCU_URL =
  'https://github.com/radio-crestin/Holy-Bible-XML-Format/raw/refs/tags/v1.0.1/data/RomanianBible.xml'

/**
 * Seeds the Romanian Cornilescu Bible
 * Only runs if no translations exist in the database
 */
export async function seedRCCV(): Promise<boolean> {
  // Check if any translations already exist
  if (hasTranslations()) {
    log('debug', 'Translations already exist, skipping Cornilescu seed')
    return false
  }

  // Double check Cornilescu doesn't exist (in case of partial import)
  const existing = getTranslationByAbbreviation('CORN')
  if (existing) {
    log('debug', 'Cornilescu already exists, skipping seed')
    return false
  }

  log('info', 'No Bible translations found, seeding Romanian Cornilescu...')

  try {
    // Fetch the OSIS XML from Holy-Bible-XML-Format
    log('info', `Fetching Cornilescu from ${CORNILESCU_URL}`)
    const response = await fetch(CORNILESCU_URL)

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Cornilescu: ${response.status} ${response.statusText}`,
      )
    }

    const xmlContent = await response.text()
    log('info', `Downloaded ${xmlContent.length} bytes`)

    // Import the translation (OSIS format)
    const result = importBibleTranslation({
      name: 'Biblia Cornilescu',
      abbreviation: 'CORN',
      language: 'ro',
      xmlContent,
    })

    if (result.success) {
      log(
        'info',
        `Cornilescu seeded successfully: ${result.booksImported} books, ${result.versesImported} verses`,
      )
      return true
    }

    log('error', `Failed to seed Cornilescu: ${result.error}`)
    return false
  } catch (error) {
    log('error', `Error seeding Cornilescu: ${error}`)
    return false
  }
}

/**
 * Checks if Cornilescu needs to be seeded and performs the seed if necessary
 * This should be called on server startup
 */
export async function ensureRCCVExists(): Promise<void> {
  try {
    await seedRCCV()
  } catch (error) {
    log('error', `Cornilescu seed check failed: ${error}`)
  }
}
