import { basename } from 'node:path'

import { BackgroundMediaError } from './BackgroundMediaError'
import { parseRangeHeader } from './parseRangeHeader'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/** File names are content-unique, so cache forever. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * Serves a media file with byte-range support. WebKit (macOS / Linux
 * webviews) will not play an mp4 unless the server answers `Range` requests
 * with proper 206 responses, so:
 * - no/ignored range → 200 with the whole file
 * - `bytes=a-b` / `bytes=a-` / `bytes=-n` → 206 with `Content-Range`
 * - range past the end → 416 with `Content-Range: bytes *\/<size>`
 *
 * With `headOnly` the same status and headers are returned without a body.
 * Throws {@link BackgroundMediaError} 404 if missing.
 */
export async function serveMediaFile(
  path: string,
  mimeType: string,
  rangeHeader: string | null,
  headOnly: boolean,
): Promise<Response> {
  const id = basename(path)
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new BackgroundMediaError(404, 'Background media not found')
  }

  const size = file.size
  const range = parseRangeHeader(rangeHeader, size)

  if (range.type === 'unsatisfiable') {
    logger.trace(`Unsatisfiable range "${rangeHeader}" for ${id} (${size})`)
    return new Response(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${size}` },
    })
  }

  const headers = new Headers({
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': CACHE_CONTROL,
  })

  if (range.type === 'range') {
    const { start, end } = range
    logger.trace(`Serving ${id} bytes ${start}-${end}/${size}`)
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    headers.set('Content-Length', String(end - start + 1))
    return new Response(headOnly ? null : file.slice(start, end + 1), {
      status: 206,
      headers,
    })
  }

  logger.trace(`Serving ${id} in full (${size} bytes)`)
  headers.set('Content-Length', String(size))
  return new Response(headOnly ? null : file, { status: 200, headers })
}
