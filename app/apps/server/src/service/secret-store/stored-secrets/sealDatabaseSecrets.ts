import { recordResetFeatures } from './resetFeatures'
import { sealStoredSecrets } from './sealStoredSecrets'
import type { Database } from 'bun:sqlite'
import { createLogger } from '../../../utils/logger'
import { hasActiveKey } from '../keyRing'

const logger = createLogger('secret-store')

/**
 * Rewrites the whole file once plain-text secrets were sealed, so no copy of
 * them stays in freed pages or the WAL (the raw file is what a backup
 * carries).
 */
function scrubFreedPages(db: Database): void {
  const start = performance.now()
  db.run('PRAGMA wal_checkpoint(TRUNCATE)')
  db.run('VACUUM')
  db.run('PRAGMA wal_checkpoint(TRUNCATE)')
  logger.info(
    `Rewrote the database without its old plain-text secrets in ${(performance.now() - start).toFixed(0)} ms`,
  )
}

/**
 * Seals the secrets of a database just opened (sealStoredSecrets) and, when
 * values from another computer were forgotten, records which features to
 * set up again. Skipped, and logged, while the data key is locked: nothing
 * is changed until it opens.
 */
export async function sealDatabaseSecrets(
  db: Database,
  { forgetUnreadable }: { forgetUnreadable: boolean },
): Promise<void> {
  if (!hasActiveKey()) {
    logger.error('Stored secrets were not checked: the data key is locked')
    return
  }
  const report = await sealStoredSecrets(db, { forgetUnreadable })
  if (report.sealed + report.rewrapped + report.forgotten.size > 0) {
    logger.info(
      `Secrets: ${report.sealed} sealed, ${report.rewrapped} moved to this computer's key, from another computer: ${[...report.forgotten].join(', ') || 'none'}`,
    )
  }
  if (forgetUnreadable && report.forgotten.size > 0) {
    recordResetFeatures(db, report.forgotten)
  }
  if (report.sealed > 0) scrubFreedPages(db)
}
