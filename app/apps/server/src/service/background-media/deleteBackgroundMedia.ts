import { existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'

import { BackgroundMediaError } from './BackgroundMediaError'
import { resolveBackgroundMediaPath } from './resolveBackgroundMediaPath'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/**
 * Deletes an uploaded background. Throws {@link BackgroundMediaError} 400 for
 * a malformed id and 404 when the file does not exist. Screen configs that
 * still reference its URL are not touched.
 */
export async function deleteBackgroundMedia(id: string): Promise<void> {
  const path = resolveBackgroundMediaPath(id)
  if (!existsSync(path)) {
    throw new BackgroundMediaError(404, 'Background media not found')
  }

  await unlink(path)
  logger.info(`Deleted background media ${id}`)
}
