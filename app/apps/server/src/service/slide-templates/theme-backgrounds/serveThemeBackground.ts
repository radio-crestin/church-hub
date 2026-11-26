import { join } from 'node:path'

import {
  THEME_BACKGROUND_FILE_REGEX,
  THEME_BACKGROUND_MIME_TYPES,
} from './constants'
import { getThemeBackgroundsDir } from './getThemeBackgroundsDir'
import { BackgroundMediaError } from '../../background-media/BackgroundMediaError'
import { serveMediaFile } from '../../background-media/serveMediaFile'

/**
 * Serves a built-in theme's background (Range aware, for WebKit's video).
 * Throws {@link BackgroundMediaError} 400 for a name outside the folder, 404
 * when it isn't there.
 */
export function serveThemeBackground(
  fileName: string,
  rangeHeader: string | null,
  headOnly: boolean,
): Promise<Response> {
  const match = fileName.match(THEME_BACKGROUND_FILE_REGEX)
  if (!match) {
    throw new BackgroundMediaError(400, 'Invalid theme background name')
  }
  return serveMediaFile(
    join(getThemeBackgroundsDir(), fileName),
    THEME_BACKGROUND_MIME_TYPES[match[1] as string] as string,
    rangeHeader,
    headOnly,
  )
}
