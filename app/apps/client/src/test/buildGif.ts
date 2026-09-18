interface BuildGifOptions {
  /** Logical screen size */
  width: number
  height: number
  frames: number
  /** A 2-colour table on each frame instead of a global one */
  localColorTables?: boolean
  /** Adds a NETSCAPE2.0 (loop forever) application extension */
  loop?: boolean
  /** Adds a comment extension with this text before the first frame */
  comment?: string
  /** Leave out the trailer byte */
  noTrailer?: boolean
}

const uint16 = (value: number) => [value & 0xff, (value >> 8) & 0xff]
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))
// Black and white.
const TWO_COLORS = [0, 0, 0, 0xff, 0xff, 0xff]

/**
 * A minimal but valid GIF89a for tests: every frame is a 1×1 pixel (LZW data
 * `44 01`), each with a graphic control extension (0.1 s delay).
 */
export function buildGif({
  width,
  height,
  frames,
  localColorTables = false,
  loop = false,
  comment,
  noTrailer = false,
}: BuildGifOptions): Uint8Array {
  const bytes = [
    ...ascii('GIF89a'),
    ...uint16(width),
    ...uint16(height),
    // Global colour table flag with 2 entries, or none.
    localColorTables ? 0x00 : 0x80,
    0,
    0,
    ...(localColorTables ? [] : TWO_COLORS),
  ]
  if (loop) {
    bytes.push(0x21, 0xff, 11, ...ascii('NETSCAPE2.0'), 3, 1, 0, 0, 0)
  }
  if (comment) {
    bytes.push(0x21, 0xfe, comment.length, ...ascii(comment), 0)
  }
  for (let frame = 0; frame < frames; frame++) {
    bytes.push(0x21, 0xf9, 4, 0x04, ...uint16(10), 0, 0)
    bytes.push(0x2c, ...uint16(0), ...uint16(0), ...uint16(1), ...uint16(1))
    bytes.push(localColorTables ? 0x80 : 0x00)
    if (localColorTables) bytes.push(...TWO_COLORS)
    bytes.push(2, 2, 0x44, 0x01, 0)
  }
  if (!noTrailer) bytes.push(0x3b)
  return new Uint8Array(bytes)
}
