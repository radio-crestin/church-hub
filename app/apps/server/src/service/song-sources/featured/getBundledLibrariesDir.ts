import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { getResourcesDir } from '../../../utils/paths'

/**
 * The featured libraries shipped with the installer (scripts/
 * bundle-song-libraries.ts): the app's resources when packaged,
 * app/tauri/resources/song-libraries in development, or
 * CHURCH_HUB_BUNDLED_LIBRARIES_DIR. Null when there are none.
 */
export function getBundledLibrariesDir(): string | null {
  const resourcesDir = getResourcesDir()
  const dir =
    process.env.CHURCH_HUB_BUNDLED_LIBRARIES_DIR ||
    (resourcesDir
      ? join(resourcesDir, 'song-libraries')
      : join(
          import.meta.dir,
          '../../../../../../tauri/resources/song-libraries',
        ))
  return existsSync(dir) ? dir : null
}
