import {
  BACKGROUND_MEDIA_EXTENSION_TYPES,
  BACKGROUND_MEDIA_MIME_TYPES,
} from '../constants'
import type { BackgroundMediaKind } from '../service/types'

/**
 * The file input's `accept` list — for one kind, or for images and videos
 * alike when no kind is given: MIME types plus extensions, since some platform
 * file dialogs (WebKitGTK, WKWebView) filter by one or the other.
 */
export function getBackgroundMediaAccept(kind?: BackgroundMediaKind): string {
  const mimeTypes = kind
    ? BACKGROUND_MEDIA_MIME_TYPES[kind]
    : Object.values(BACKGROUND_MEDIA_MIME_TYPES).flat()
  const extensions = Object.entries(BACKGROUND_MEDIA_EXTENSION_TYPES)
    .filter(([, mimeType]) => mimeTypes.includes(mimeType))
    .map(([extension]) => `.${extension}`)
  return [...mimeTypes, ...extensions].join(',')
}
