import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import { sealDatabaseSecrets } from './sealDatabaseSecrets'
import { Database } from 'bun:sqlite'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('secret-store')
const VERSION_COPY = /^app-v.+\.db$/

/**
 * The database copies the app keeps next to app.db: one per version
 * (app-v<version>.db, made before each upgrade's migrations) and the one an
 * import falls back on (app.db.backup).
 */
function legacyCopies(databasePath: string, dataDir: string): string[] {
  const importFallback = `${databasePath}.backup`
  return [
    ...readdirSync(dataDir)
      .filter(
        (name) => VERSION_COPY.test(name) && name !== basename(databasePath),
      )
      .map((name) => join(dataDir, name)),
    ...(existsSync(importFallback) ? [importFallback] : []),
  ]
}

/**
 * Seals the secrets in those copies too, or the plain text an older version
 * left in them would stay readable in the data folder. A copy that no
 * longer opens is logged and skipped: it must not stop the start.
 */
export async function sealLegacyCopies(
  databasePath: string,
  dataDir: string,
): Promise<void> {
  for (const path of legacyCopies(databasePath, dataDir)) {
    let copy: Database | null = null
    try {
      copy = new Database(path)
      await sealDatabaseSecrets(copy, { forgetUnreadable: false })
    } catch (error) {
      logger.warning(`Could not seal the secrets in ${path}: ${error}`)
    } finally {
      copy?.close()
    }
  }
}
