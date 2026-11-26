import { existsSync, readdirSync } from 'node:fs'

import { BACKGROUND_MEDIA_ID_REGEX } from './constants'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { getBackgroundMediaTypeById } from './getBackgroundMediaTypeById'

/** The ids of the videos in the gallery (the video library), in no order. */
export function listBackgroundVideoIds(): string[] {
  const dir = getBackgroundMediaDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(
    (id) =>
      BACKGROUND_MEDIA_ID_REGEX.test(id) &&
      getBackgroundMediaTypeById(id).kind === 'video',
  )
}
