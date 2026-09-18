import { describe, expect, it } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { inspectGif } from '../inspectGif'

// The classic 43-byte transparent pixel, as encoders write it.
const PIXEL_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (char) => char.charCodeAt(0),
)

describe('inspectGif', () => {
  it('reads a static one-frame GIF', () => {
    expect(inspectGif(PIXEL_GIF)).toEqual({
      width: 1,
      height: 1,
      frameCount: 1,
    })
  })

  it('accepts an ArrayBuffer and the GIF87a signature', () => {
    const gif87 = PIXEL_GIF.slice()
    gif87.set([0x38, 0x37], 3)
    expect(inspectGif(gif87.buffer)).toEqual({
      width: 1,
      height: 1,
      frameCount: 1,
    })
  })

  it('counts the frames of an animation at its logical screen size', () => {
    expect(
      inspectGif(buildGif({ width: 700, height: 394, frames: 12 })),
    ).toEqual({ width: 700, height: 394, frameCount: 12 })
  })

  it('skips local colour tables, comment and NETSCAPE loop extensions', () => {
    const gif = buildGif({
      width: 1500,
      height: 1500,
      frames: 15,
      localColorTables: true,
      loop: true,
      // Contains the image separator and trailer bytes (",", ";").
      comment: 'made, for; tests',
    })
    expect(inspectGif(gif)).toEqual({
      width: 1500,
      height: 1500,
      frameCount: 15,
    })
  })

  it('treats a missing trailer as the end of the file', () => {
    expect(
      inspectGif(
        buildGif({ width: 10, height: 10, frames: 3, noTrailer: true }),
      ),
    ).toEqual({ width: 10, height: 10, frameCount: 3 })
  })

  it('returns null for a file cut off inside a block', () => {
    const gif = buildGif({ width: 10, height: 10, frames: 3 })
    // Inside the last frame's image data.
    expect(inspectGif(gif.subarray(0, gif.length - 3))).toBeNull()
    // Inside the global colour table.
    expect(inspectGif(gif.subarray(0, 15))).toBeNull()
    // Inside the last image descriptor.
    expect(inspectGif(gif.subarray(0, gif.length - 10))).toBeNull()
  })

  it('returns null for bytes that are not a GIF', () => {
    expect(inspectGif(new Uint8Array())).toBeNull()
    expect(inspectGif(new TextEncoder().encode('GIF89'))).toBeNull()
    expect(
      inspectGif(new TextEncoder().encode('\x89PNG\r\n\x1a\n not a gif')),
    ).toBeNull()
  })

  it('does not throw on random bytes after a valid header', () => {
    const gif = buildGif({ width: 4, height: 4, frames: 1, noTrailer: true })
    const garbage = new Uint8Array(gif.length + 64)
    garbage.set(gif)
    for (let i = gif.length; i < garbage.length; i++) {
      garbage[i] = (i * 37) % 256
    }
    expect(() => inspectGif(garbage)).not.toThrow()
  })
})
