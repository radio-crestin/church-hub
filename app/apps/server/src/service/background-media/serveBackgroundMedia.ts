import { getBackgroundMediaTypeById } from './getBackgroundMediaTypeById'
import { resolveBackgroundMediaPath } from './resolveBackgroundMediaPath'
import { serveMediaFile } from './serveMediaFile'

/**
 * Serves a stored background (Range aware, see serveMediaFile). Throws
 * {@link BackgroundMediaError} 400 for a malformed id, 404 if missing.
 */
export function serveBackgroundMedia(
  id: string,
  rangeHeader: string | null,
  headOnly: boolean,
): Promise<Response> {
  return serveMediaFile(
    resolveBackgroundMediaPath(id),
    getBackgroundMediaTypeById(id).mimeType,
    rangeHeader,
    headOnly,
  )
}
