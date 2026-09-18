const BACKGROUND_TYPES = ['transparent', 'color', 'image', 'video'] as const

const STRING_FIELDS = ['color', 'imageUrl', 'videoUrl'] as const

/**
 * Checks a song background override coming from a request body before it is
 * stored. `undefined` (leave unchanged) and `null` (clear) are accepted as-is;
 * anything else must be a `ScreenBackgroundConfig`: a known `type`, a finite
 * `opacity` in [0, 1] and string-only `color` / `imageUrl` / `videoUrl`.
 *
 * @returns a message describing the first problem, or null when valid.
 */
export function validateSongBackground(value: unknown): string | null {
  if (value === undefined || value === null) return null

  if (typeof value !== 'object' || Array.isArray(value)) {
    return 'Invalid background: expected an object or null'
  }

  const background = value as Record<string, unknown>

  if (
    typeof background.type !== 'string' ||
    !(BACKGROUND_TYPES as readonly string[]).includes(background.type)
  ) {
    return `Invalid background: type must be one of ${BACKGROUND_TYPES.join(', ')}`
  }

  const { opacity } = background
  if (
    typeof opacity !== 'number' ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1
  ) {
    return 'Invalid background: opacity must be a number between 0 and 1'
  }

  for (const field of STRING_FIELDS) {
    const fieldValue = background[field]
    if (fieldValue !== undefined && typeof fieldValue !== 'string') {
      return `Invalid background: ${field} must be a string`
    }
  }

  return null
}
