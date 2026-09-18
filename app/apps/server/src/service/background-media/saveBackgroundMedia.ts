import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { BackgroundMediaError } from './BackgroundMediaError'
import { BACKGROUND_MEDIA_MAX_BYTES, BACKGROUND_MEDIA_TYPES } from './constants'
import { getBackgroundMediaDir } from './getBackgroundMediaDir'
import { toBackgroundMedia } from './toBackgroundMedia'
import type { BackgroundMedia, SaveBackgroundMediaInput } from './types'
import { writeLimitedStreamToFile } from './writeLimitedStreamToFile'
import { createLogger } from '../../utils/logger'

const logger = createLogger('background-media')

/**
 * Stores an uploaded background image/video. The raw request body is streamed
 * to a hidden `.part` file in the media folder and renamed into place only
 * once it is complete and within the size limit for its kind, so a listing
 * never shows a half-written file.
 *
 * Throws {@link BackgroundMediaError}: 415 unsupported/missing type, 413 over
 * the limit (declared or streamed), 400 empty body.
 */
export async function saveBackgroundMedia(
  input: SaveBackgroundMediaInput,
): Promise<BackgroundMedia> {
  const mimeType = (input.contentType ?? '').split(';')[0]?.trim().toLowerCase()
  const type = BACKGROUND_MEDIA_TYPES.find((t) => t.mimeType === mimeType)
  if (!type) {
    throw new BackgroundMediaError(
      415,
      `Unsupported media type: ${mimeType || 'missing Content-Type'}`,
    )
  }

  const maxBytes = BACKGROUND_MEDIA_MAX_BYTES[type.kind]
  const declaredSize = input.contentLength ? Number(input.contentLength) : null
  if (declaredSize !== null && declaredSize > maxBytes) {
    throw new BackgroundMediaError(
      413,
      `File is larger than the ${maxBytes}-byte limit`,
    )
  }
  if (!input.body || declaredSize === 0) {
    throw new BackgroundMediaError(400, 'Request body is empty')
  }

  const dir = getBackgroundMediaDir()
  await mkdir(dir, { recursive: true })

  const id = `${randomUUID()}.${type.extension}`
  const tempPath = join(dir, `.${id}.part`)
  const name = JSON.stringify(input.originalName ?? '')
  logger.debug(
    `Upload started: ${id} (${mimeType}, name ${name}, declared ${declaredSize ?? 'unknown'} bytes)`,
  )

  const size = await writeLimitedStreamToFile(input.body, tempPath, maxBytes)
  if (size === 0) {
    await rm(tempPath, { force: true })
    throw new BackgroundMediaError(400, 'Request body is empty')
  }

  const finalPath = join(dir, id)
  await rename(tempPath, finalPath)
  const { mtimeMs } = await stat(finalPath)

  logger.info(`Saved background ${type.kind} ${id} (${size} bytes, ${name})`)
  return toBackgroundMedia(id, size, mtimeMs)
}
