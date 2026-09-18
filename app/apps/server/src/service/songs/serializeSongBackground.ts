import type { ScreenBackgroundConfig } from '../presentation/types'

/**
 * Serializes a song background override for the `songs.background` column.
 * Only the known config keys are kept, so stray request fields never reach
 * the database; no override stores as NULL (use the screen's background).
 */
export function serializeSongBackground(
  background: ScreenBackgroundConfig | null | undefined,
): string | null {
  if (!background) return null
  const { type, color, imageUrl, videoUrl, opacity } = background
  return JSON.stringify({ type, color, imageUrl, videoUrl, opacity })
}
