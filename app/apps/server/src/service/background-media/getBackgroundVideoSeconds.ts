import { join } from 'node:path'
import { parseFile } from 'music-metadata'

import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/** How long a gallery video plays, in seconds; null when it can't be read. */
export async function getBackgroundVideoSeconds(
  id: string,
): Promise<number | null> {
  try {
    const metadata = await parseFile(join(getBackgroundMediaDir(), id), {
      duration: true,
    })
    return metadata.format.duration ?? null
  } catch (error) {
    logger.warning(`Could not read the length of video ${id}: ${error}`)
    return null
  }
}
