import { getBackgroundMediaMimeType } from './getBackgroundMediaMimeType'
import { BACKGROUND_MEDIA_MIME_TYPES } from '../constants'
import type { BackgroundMediaKind } from '../service/types'

const KINDS = Object.keys(BACKGROUND_MEDIA_MIME_TYPES) as BackgroundMediaKind[]

/**
 * Whether a picked file is an image or a video background, from its MIME type
 * (or its extension when the OS reports none). Null when it is neither.
 */
export function getBackgroundMediaKind(file: File): BackgroundMediaKind | null {
  const mimeType = getBackgroundMediaMimeType(file)
  return (
    KINDS.find((kind) =>
      BACKGROUND_MEDIA_MIME_TYPES[kind].includes(mimeType),
    ) ?? null
  )
}
