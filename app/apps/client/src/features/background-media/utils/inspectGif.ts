/** What a GIF's structure says about it, read without decoding any pixel. */
export interface GifInfo {
  /** Logical screen size — every frame is decoded at this size */
  width: number
  height: number
  /** Image descriptors, one per animation frame */
  frameCount: number
}

const SIGNATURES = ['GIF87a', 'GIF89a']
const HEADER_LENGTH = 6
const SCREEN_DESCRIPTOR_LENGTH = 7
const IMAGE_DESCRIPTOR_LENGTH = 9
const EXTENSION_INTRODUCER = 0x21
const IMAGE_SEPARATOR = 0x2c
const TRAILER = 0x3b
const HAS_COLOR_TABLE = 0x80

/** Bytes of a colour table flagged in a packed field (3 per entry). */
function colorTableLength(packed: number): number {
  return packed & HAS_COLOR_TABLE ? 3 * 2 ** ((packed & 0x07) + 1) : 0
}

/**
 * Reads a GIF's logical screen size and counts its frames by walking its
 * blocks (extensions, image descriptors, colour tables and data sub-blocks)
 * without decoding the image data. Returns null when the bytes are not a GIF
 * or end in the middle of a block. Like browsers, it treats a missing trailer
 * or stray bytes where a block should start as the end of the file.
 */
export function inspectGif(data: ArrayBuffer | Uint8Array): GifInfo | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.length < HEADER_LENGTH + SCREEN_DESCRIPTOR_LENGTH) return null

  const signature = String.fromCharCode(...bytes.subarray(0, HEADER_LENGTH))
  if (!SIGNATURES.includes(signature)) return null

  const readUint16 = (at: number) => bytes[at] | (bytes[at + 1] << 8)
  const width = readUint16(HEADER_LENGTH)
  const height = readUint16(HEADER_LENGTH + 2)
  let offset =
    HEADER_LENGTH +
    SCREEN_DESCRIPTOR_LENGTH +
    colorTableLength(bytes[HEADER_LENGTH + 4])
  if (offset > bytes.length) return null

  // Skips a chain of data sub-blocks (a length byte, then that many bytes)
  // up to its zero-length terminator; false when the data ends first.
  const skipSubBlocks = () => {
    while (offset < bytes.length) {
      const size = bytes[offset]
      offset += size + 1
      if (size === 0) return true
    }
    return false
  }

  let frameCount = 0
  while (offset < bytes.length) {
    const introducer = bytes[offset]

    if (introducer === TRAILER) break

    if (introducer === EXTENSION_INTRODUCER) {
      // Introducer and label, then the extension's sub-blocks.
      offset += 2
      if (!skipSubBlocks()) return null
      continue
    }

    if (introducer !== IMAGE_SEPARATOR) break

    const descriptorEnd = offset + 1 + IMAGE_DESCRIPTOR_LENGTH
    if (descriptorEnd > bytes.length) return null
    // Local colour table, then the LZW minimum code size byte.
    offset = descriptorEnd + colorTableLength(bytes[descriptorEnd - 1]) + 1
    if (!skipSubBlocks()) return null
    frameCount++
  }

  return { width, height, frameCount }
}
