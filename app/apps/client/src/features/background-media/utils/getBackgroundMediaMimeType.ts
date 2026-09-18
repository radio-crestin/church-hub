import { BACKGROUND_MEDIA_EXTENSION_TYPES } from '../constants'

/**
 * The file's MIME type, falling back to its extension when the OS reports none
 * (an empty `File.type`), so the same file is accepted on every platform.
 */
export function getBackgroundMediaMimeType(file: File): string {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return BACKGROUND_MEDIA_EXTENSION_TYPES[extension] ?? ''
}
