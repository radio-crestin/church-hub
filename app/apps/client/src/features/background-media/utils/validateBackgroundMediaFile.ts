import { getBackgroundMediaMimeType } from './getBackgroundMediaMimeType'
import {
  BACKGROUND_MEDIA_MAX_BYTES,
  BACKGROUND_MEDIA_MIME_TYPES,
} from '../constants'
import type {
  BackgroundMediaErrorCode,
  BackgroundMediaKind,
} from '../service/types'

/**
 * Checks a picked file against the server's rules before uploading it, so a
 * wrong type or an oversized video fails at once instead of after the upload.
 * Returns the reason it is refused, or null when it can be uploaded.
 */
export function validateBackgroundMediaFile(
  file: File,
  kind: BackgroundMediaKind,
): BackgroundMediaErrorCode | null {
  if (
    !BACKGROUND_MEDIA_MIME_TYPES[kind].includes(
      getBackgroundMediaMimeType(file),
    )
  ) {
    return 'unsupportedType'
  }
  if (file.size > BACKGROUND_MEDIA_MAX_BYTES[kind]) {
    return 'fileTooLarge'
  }
  return null
}
