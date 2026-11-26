import { existsSync } from 'node:fs'

import { BackgroundMediaError } from './BackgroundMediaError'
import { BACKGROUND_MEDIA_URL_PREFIX } from './constants'
import { getBackgroundMediaTypeById } from './getBackgroundMediaTypeById'
import { resolveBackgroundMediaPath } from './resolveBackgroundMediaPath'
import type { BackgroundMediaKind } from './types'

/**
 * A gallery file of the given kind, by id, as the screens load it. Throws a
 * 400 for a malformed id or another kind, and a 404 for a missing file.
 */
export function getGalleryMediaRef(
  mediaId: unknown,
  kind: BackgroundMediaKind,
): { mediaId: string; url: string } {
  if (typeof mediaId !== 'string') {
    throw new BackgroundMediaError(400, 'mediaId is required')
  }
  const path = resolveBackgroundMediaPath(mediaId)
  if (getBackgroundMediaTypeById(mediaId).kind !== kind) {
    throw new BackgroundMediaError(400, `The file is not a ${kind}`)
  }
  if (!existsSync(path)) {
    throw new BackgroundMediaError(404, 'Background media not found')
  }
  return { mediaId, url: `${BACKGROUND_MEDIA_URL_PREFIX}/${mediaId}` }
}
