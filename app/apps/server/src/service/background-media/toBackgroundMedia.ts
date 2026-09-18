import { BACKGROUND_MEDIA_URL_PREFIX } from './constants'
import { getBackgroundMediaTypeById } from './getBackgroundMediaTypeById'
import type { BackgroundMedia } from './types'

/** Builds the API representation of a stored file. */
export function toBackgroundMedia(
  id: string,
  size: number,
  modifiedAtMs: number,
): BackgroundMedia {
  const { kind, mimeType } = getBackgroundMediaTypeById(id)
  return {
    id,
    kind,
    mimeType,
    size,
    url: `${BACKGROUND_MEDIA_URL_PREFIX}/${id}`,
    createdAt: Math.floor(modifiedAtMs),
  }
}
