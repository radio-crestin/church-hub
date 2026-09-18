import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../utils/paths'

/**
 * Folder holding uploaded screen backgrounds, next to the database so it
 * follows `DATABASE_PATH` (e2e runs write into their own test-data folder).
 * Resolved on every call; callers create it lazily.
 */
export function getBackgroundMediaDir(): string {
  return join(dirname(getDatabasePath()), 'media', 'backgrounds')
}
