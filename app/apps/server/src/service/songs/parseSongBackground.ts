import { validateSongBackground } from './validateSongBackground'
import { createLogger } from '../../utils/logger'
import type { ScreenBackgroundConfig } from '../presentation/types'

const logger = createLogger('songs')

/**
 * Reads the stored per-song background override. Malformed JSON, or JSON that
 * is not a valid background config, is treated as "no override" rather than
 * failing the read — the song must still load and render on the screen's own
 * background.
 */
export function parseSongBackground(
  raw: string | null | undefined,
): ScreenBackgroundConfig | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    logger.warning('Ignoring malformed song background JSON')
    return null
  }

  const error =
    parsed === null ? 'expected an object' : validateSongBackground(parsed)
  if (error) {
    logger.warning(`Ignoring invalid stored song background: ${error}`)
    return null
  }

  return parsed as ScreenBackgroundConfig
}
