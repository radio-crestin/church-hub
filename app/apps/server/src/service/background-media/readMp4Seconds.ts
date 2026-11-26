import { closeSync, fstatSync, openSync, readSync } from 'node:fs'

/** Reads `length` bytes at `position`. */
function readAt(fd: number, position: number, length: number): Buffer {
  const buffer = Buffer.alloc(length)
  readSync(fd, buffer, 0, length, position)
  return buffer
}

/** The first box named `type` between `start` and `end`, by its body's range. */
function findBox(fd: number, start: number, end: number, type: string) {
  let position = start
  while (position + 8 <= end) {
    const header = readAt(fd, position, 16)
    let size = header.readUInt32BE(0)
    let bodyStart = position + 8
    if (size === 1) {
      size = Number(header.readBigUInt64BE(8))
      bodyStart = position + 16
    } else if (size === 0) {
      size = end - position
    }
    if (size < 8) return null
    if (header.toString('latin1', 4, 8) === type) {
      return { start: bodyStart, end: position + size }
    }
    position += size
  }
  return null
}

/**
 * An MP4's length in seconds from its movie header (moov/mvhd), which every
 * MP4 has, with or without sound; null when it has none.
 */
export function readMp4Seconds(path: string): number | null {
  const fd = openSync(path, 'r')
  try {
    const moov = findBox(fd, 0, fstatSync(fd).size, 'moov')
    const mvhd = moov && findBox(fd, moov.start, moov.end, 'mvhd')
    if (!mvhd) return null
    const body = readAt(fd, mvhd.start, 32)
    const version = body.readUInt8(0)
    const timescale = body.readUInt32BE(version === 1 ? 20 : 12)
    const duration =
      version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16)
    return timescale > 0 ? duration / timescale : null
  } finally {
    closeSync(fd)
  }
}
