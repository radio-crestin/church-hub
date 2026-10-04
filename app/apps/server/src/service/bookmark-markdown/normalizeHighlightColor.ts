import { DEFAULT_HIGHLIGHT_COLOR } from './types'

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i
const NAMED_COLOR = /^[a-z]+$/i

/**
 * Upper-cases a hex colour so `#ffff00` and `#FFFF00` compare equal, and
 * falls back to the default for anything that is not a plain colour — the
 * value ends up inside an HTML attribute.
 */
export function normalizeHighlightColor(color: string): string {
  const trimmed = color.trim()
  if (HEX_COLOR.test(trimmed)) return trimmed.toUpperCase()
  if (NAMED_COLOR.test(trimmed)) return trimmed.toLowerCase()
  return DEFAULT_HIGHLIGHT_COLOR
}
