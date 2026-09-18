import { join } from 'node:path'

import { DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR } from './constants'
import { getResourcesDir } from '../../utils/paths'

/**
 * Folder holding the backgrounds shipped with the app:
 * - desktop app: the bundled resources (`<App>.app/Contents/Resources/` on
 *   macOS, next to the executable on Windows/Linux — see getResourcesDir)
 * - dev server and e2e runs: `tauri/resources/` in the checkout
 */
export function getDefaultBackgroundMediaSourceDir(): string {
  const resourcesDir = getResourcesDir()
  if (resourcesDir) {
    return join(resourcesDir, DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR)
  }
  // This file is at apps/server/src/service/background-media/; the resources
  // are at tauri/resources/.
  return join(
    import.meta.dir,
    '..',
    '..',
    '..',
    '..',
    '..',
    'tauri',
    'resources',
    DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR,
  )
}
