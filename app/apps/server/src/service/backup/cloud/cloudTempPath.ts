import { dirname, join } from 'node:path'

import { getDatabasePath } from '../../../utils/paths'

/**
 * A temp file for a cloud backup or restore, next to the database: that
 * folder always exists and is on the same disk the database fits on.
 */
export function cloudTempPath(name: string, extension: string): string {
  return join(dirname(getDatabasePath()), `.${name}-${Date.now()}.${extension}`)
}
