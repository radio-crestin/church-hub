import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { BACKGROUND_MEDIA_ID_REGEX } from './constants'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { toBackgroundMedia } from './toBackgroundMedia'
import type { BackgroundMedia } from './types'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/**
 * Lists uploaded backgrounds, newest first. Only files named like a media id
 * are returned, so in-progress `.part` uploads and stray files are skipped.
 * A missing folder (nothing uploaded yet) is an empty list.
 */
export async function listBackgroundMedia(): Promise<BackgroundMedia[]> {
  const dir = getBackgroundMediaDir()
  if (!existsSync(dir)) {
    return []
  }

  const ids = (await readdir(dir)).filter((name) =>
    BACKGROUND_MEDIA_ID_REGEX.test(name),
  )
  const media = await Promise.all(
    ids.map(async (id) => {
      const { size, mtimeMs } = await stat(join(dir, id))
      return toBackgroundMedia(id, size, mtimeMs)
    }),
  )

  logger.trace(`Listed ${media.length} background media files`)
  return media.sort((a, b) => b.createdAt - a.createdAt)
}
