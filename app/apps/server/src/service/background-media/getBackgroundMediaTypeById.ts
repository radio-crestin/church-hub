import { BACKGROUND_MEDIA_TYPES } from './constants'
import type { BackgroundMediaType } from './types'

/**
 * Looks up the stored type of a media id by its extension. Callers validate
 * the id first, so an unknown extension is a programming error.
 */
export function getBackgroundMediaTypeById(id: string): BackgroundMediaType {
  const extension = id.slice(id.lastIndexOf('.') + 1)
  const type = BACKGROUND_MEDIA_TYPES.find((t) => t.extension === extension)
  if (!type) {
    throw new Error(`Unknown background media extension: ${extension}`)
  }
  return type
}
