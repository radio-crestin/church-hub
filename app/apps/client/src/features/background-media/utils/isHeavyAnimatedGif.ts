import { createLogger } from '~/utils/logger'
import { getBackgroundMediaMimeType } from './getBackgroundMediaMimeType'
import { type GifInfo, inspectGif } from './inspectGif'
import {
  HEAVY_GIF_MAX_DECODED_BYTES,
  HEAVY_GIF_MAX_FILE_BYTES,
  HEAVY_GIF_MIN_FRAMES,
} from '../constants'

const logger = createLogger('app:background-media')

/** A GIF's structure, its file size and whether it is too heavy to play well. */
export interface AnimatedGifCheck extends GifInfo {
  heavy: boolean
  /** File size in bytes */
  size: number
}

/**
 * Whether a picked GIF is an animation heavy enough to play choppy or freeze
 * on a screen: several frames and either a large file or a large decoded size
 * (every frame is decoded at the full logical screen size). Null when the
 * file is not a GIF, or not one that can be read.
 */
export async function isHeavyAnimatedGif(
  file: File,
): Promise<AnimatedGifCheck | null> {
  if (getBackgroundMediaMimeType(file) !== 'image/gif') return null

  const info = inspectGif(await file.arrayBuffer())
  if (!info) {
    logger.debug(`${file.name} could not be read as a GIF`)
    return null
  }

  const decodedBytes = info.frameCount * info.width * info.height * 4
  const heavy =
    info.frameCount >= HEAVY_GIF_MIN_FRAMES &&
    (file.size > HEAVY_GIF_MAX_FILE_BYTES ||
      decodedBytes > HEAVY_GIF_MAX_DECODED_BYTES)
  logger.debug(
    `${file.name}: ${info.frameCount} frames at ${info.width}×${info.height}, ${file.size} bytes, ~${decodedBytes} bytes decoded — heavy: ${heavy}`,
  )

  return { ...info, heavy, size: file.size }
}
