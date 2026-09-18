import type { ByteRangeResult } from './types'

/** A single byte range: `bytes=a-b`, `bytes=a-` or `bytes=-n`. */
const SINGLE_BYTE_RANGE_REGEX = /^bytes=(\d*)-(\d*)$/i

/**
 * Parses an HTTP `Range` header against a file of `size` bytes (RFC 9110
 * §14). Only single ranges are honoured; malformed, invalid (`last < first`)
 * and multi-range headers yield `none`, i.e. the whole file with 200, which
 * the RFC allows a server to answer instead of a partial response.
 */
export function parseRangeHeader(
  header: string | null,
  size: number,
): ByteRangeResult {
  if (!header) {
    return { type: 'none' }
  }

  const match = SINGLE_BYTE_RANGE_REGEX.exec(header.trim())
  const startText = match?.[1] ?? ''
  const endText = match?.[2] ?? ''
  if (!startText && !endText) {
    return { type: 'none' }
  }

  // Suffix range `bytes=-n`: the last n bytes (the whole file if shorter).
  if (!startText) {
    const suffixLength = Number(endText)
    if (suffixLength === 0 || size === 0) {
      return { type: 'unsatisfiable' }
    }
    return {
      type: 'range',
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    }
  }

  const start = Number(startText)
  const requestedEnd = endText ? Number(endText) : Number.POSITIVE_INFINITY
  if (requestedEnd < start) {
    return { type: 'none' }
  }
  if (start >= size) {
    return { type: 'unsatisfiable' }
  }
  return { type: 'range', start, end: Math.min(requestedEnd, size - 1) }
}
