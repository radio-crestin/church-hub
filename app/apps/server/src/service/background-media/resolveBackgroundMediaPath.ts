import { join } from 'node:path'

import { BackgroundMediaError } from './BackgroundMediaError'
import { BACKGROUND_MEDIA_ID_REGEX } from './constants'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'

/**
 * Maps a media id to its absolute path. The id must match the strict
 * `<uuid>.<ext>` pattern — anything else (traversal attempts, temp files) is
 * rejected with a 400 before touching the file system.
 */
export function resolveBackgroundMediaPath(id: string): string {
  if (!BACKGROUND_MEDIA_ID_REGEX.test(id)) {
    throw new BackgroundMediaError(400, 'Invalid background media id')
  }
  return join(getBackgroundMediaDir(), id)
}
