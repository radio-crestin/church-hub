import { join } from 'node:path'
import { parseFile } from 'music-metadata'

import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { readMp4Seconds } from './readMp4Seconds'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/** How long a gallery video plays, in seconds; null when it can't be read. */
export async function getBackgroundVideoSeconds(
  id: string,
): Promise<number | null> {
  const path = join(getBackgroundMediaDir(), id)
  try {
    // A video-only MP4 has no audio track for music-metadata to time.
    if (id.endsWith('.mp4')) return readMp4Seconds(path)
    const metadata = await parseFile(path, { duration: true })
    return metadata.format.duration ?? null
  } catch (error) {
    logger.warning(`Could not read the length of video ${id}: ${error}`)
    return null
  }
}
