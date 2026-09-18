import { existsSync } from 'node:fs'
import { copyFile, mkdir, rename, utimes } from 'node:fs/promises'
import { join } from 'node:path'

import {
  DEFAULT_BACKGROUND_MEDIA,
  DEFAULT_BACKGROUND_MEDIA_MARKER_KEY,
} from './constants'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { getDefaultBackgroundMediaSourceDir } from './getDefaultBackgroundMediaSourceDir'
import { createLogger } from '../../utils/logger'
import { reportError } from '../../utils/reportError'
import { getSetting, upsertSetting } from '../settings'

const logger = createLogger('background-media')

/**
 * Copies the backgrounds shipped with the app into the media gallery, once per
 * install: new installs get them on first start, existing ones on the first
 * start after upgrading. The `app_settings` marker is set afterwards, so a
 * default the user deletes never comes back.
 *
 * Never throws — startup must not fail over a gallery default. When a bundled
 * file is missing (a checkout without it) or the copy fails, it logs and
 * leaves the marker unset so the next start tries again. A file already
 * stored under the fixed id is kept as is.
 */
export async function seedDefaultBackgroundMedia(
  sourceDir: string = getDefaultBackgroundMediaSourceDir(),
): Promise<void> {
  if (getSetting('app_settings', DEFAULT_BACKGROUND_MEDIA_MARKER_KEY)) {
    logger.debug('Default backgrounds were already added, skipping')
    return
  }

  const missing = DEFAULT_BACKGROUND_MEDIA.filter(
    ({ fileName }) => !existsSync(join(sourceDir, fileName)),
  )
  if (missing.length > 0) {
    const names = missing.map(({ fileName }) => fileName).join(', ')
    logger.warning(
      `Default backgrounds not found in ${sourceDir} (${names}); will retry on next start`,
    )
    return
  }

  const mediaDir = getBackgroundMediaDir()
  try {
    await mkdir(mediaDir, { recursive: true })
    for (const { fileName, id } of DEFAULT_BACKGROUND_MEDIA) {
      const target = join(mediaDir, id)
      if (existsSync(target)) {
        logger.debug(`Default background ${id} is already in the gallery`)
        continue
      }
      // Copied to a hidden temp name first, like an upload, so an interrupted
      // copy never shows up (or gets kept) as a truncated file.
      const tempPath = join(mediaDir, `.${id}.part`)
      await copyFile(join(sourceDir, fileName), tempPath)
      // The gallery shows the file time as the upload date; some platforms
      // keep the bundled file's time on copy (Windows), others don't.
      const now = new Date()
      await utimes(tempPath, now, now)
      await rename(tempPath, target)
      logger.info(`Added default background ${id} (${fileName})`)
    }
  } catch (error) {
    logger.error(`Could not add the default backgrounds: ${error}`)
    reportError(error, 'background-media', { step: 'seed-defaults' })
    return
  }

  const result = upsertSetting('app_settings', {
    key: DEFAULT_BACKGROUND_MEDIA_MARKER_KEY,
    value: JSON.stringify(DEFAULT_BACKGROUND_MEDIA.map(({ id }) => id)),
  })
  if (!result.success) {
    logger.error(`Could not record the default backgrounds: ${result.error}`)
    return
  }
  logger.debug(`Default backgrounds recorded under ${mediaDir}`)
}
