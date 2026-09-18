import { getBackgroundMediaKind } from './getBackgroundMediaKind'
import { BACKGROUND_MEDIA_MAX_BYTES } from '../constants'
import type {
  BackgroundMediaErrorCode,
  BackgroundMediaKind,
} from '../service/types'

/**
 * Checks a picked file against the server's rules before uploading it, so a
 * wrong type or an oversized video fails at once instead of after the upload.
 * `kind` narrows the accepted files to images or videos; without it either is
 * accepted. Returns the reason it is refused, or null when it can be uploaded.
 */
export function validateBackgroundMediaFile(
  file: File,
  kind?: BackgroundMediaKind,
): BackgroundMediaErrorCode | null {
  const fileKind = getBackgroundMediaKind(file)
  if (!fileKind || (kind && fileKind !== kind)) {
    return 'unsupportedType'
  }
  if (file.size > BACKGROUND_MEDIA_MAX_BYTES[fileKind]) {
    return 'fileTooLarge'
  }
  return null
}
