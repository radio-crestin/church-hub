import { join } from 'node:path'

import { THEME_BACKGROUNDS_RESOURCE_DIR } from './constants'
import { getResourcesDir } from '../../../utils/paths'

/**
 * Folder holding the built-in themes' backgrounds:
 * - desktop app: the bundled resources (see getResourcesDir)
 * - dev server and e2e runs: `tauri/resources/` in the checkout
 */
export function getThemeBackgroundsDir(): string {
  const resourcesDir = getResourcesDir()
  if (resourcesDir) return join(resourcesDir, THEME_BACKGROUNDS_RESOURCE_DIR)
  // This file is at apps/server/src/service/slide-templates/theme-backgrounds/;
  // the resources are at tauri/resources/.
  return join(
    import.meta.dir,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'tauri',
    'resources',
    THEME_BACKGROUNDS_RESOURCE_DIR,
  )
}
