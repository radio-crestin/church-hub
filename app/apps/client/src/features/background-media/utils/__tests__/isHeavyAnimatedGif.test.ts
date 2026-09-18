import { describe, expect, it } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { makeReadableFile } from '../../../../test/makeReadableFile'
import { isHeavyAnimatedGif } from '../isHeavyAnimatedGif'

const MIB = 1024 * 1024

function gifFile(
  parts: (Uint8Array | string)[],
  name = 'animation.gif',
  type = 'image/gif',
): File {
  return makeReadableFile(parts, name, type)
}

describe('isHeavyAnimatedGif', () => {
  it('flags an animation that decodes to more than 100 MiB', async () => {
    // 15 × 1500 × 1500 × 4 bytes ≈ 129 MiB, in a file of a few hundred bytes.
    const gif = buildGif({ width: 1500, height: 1500, frames: 15 })
    expect(await isHeavyAnimatedGif(gifFile([gif]))).toEqual({
      heavy: true,
      width: 1500,
      height: 1500,
      frameCount: 15,
      size: gif.length,
    })
  })

  it('flags an animation whose file is larger than 5 MiB', async () => {
    const gif = buildGif({ width: 10, height: 10, frames: 2 })
    // Bytes after the trailer only make the file larger.
    const file = gifFile([gif, new Uint8Array(5 * MIB)])
    expect(await isHeavyAnimatedGif(file)).toMatchObject({
      heavy: true,
      frameCount: 2,
      size: gif.length + 5 * MIB,
    })
  })

  it('lets a small animation through', async () => {
    const gif = buildGif({ width: 700, height: 394, frames: 10 })
    expect(await isHeavyAnimatedGif(gifFile([gif]))).toMatchObject({
      heavy: false,
      frameCount: 10,
    })
  })

  it('never flags a single-frame GIF, however large', async () => {
    const gif = buildGif({ width: 8000, height: 8000, frames: 1 })
    const file = gifFile([gif, new Uint8Array(6 * MIB)])
    expect(await isHeavyAnimatedGif(file)).toMatchObject({
      heavy: false,
      frameCount: 1,
    })
  })

  it('recognises a GIF by its extension when the OS reports no type', async () => {
    const gif = buildGif({ width: 1500, height: 1500, frames: 15 })
    expect(
      await isHeavyAnimatedGif(gifFile([gif], 'ANIMATION.GIF', '')),
    ).toMatchObject({ heavy: true })
  })

  it('returns null for other images and unreadable GIFs', async () => {
    const gif = buildGif({ width: 1500, height: 1500, frames: 15 })
    expect(
      await isHeavyAnimatedGif(gifFile([gif], 'still.png', 'image/png')),
    ).toBeNull()
    expect(
      await isHeavyAnimatedGif(gifFile([gif.subarray(0, gif.length - 3)])),
    ).toBeNull()
    expect(await isHeavyAnimatedGif(gifFile(['not a gif']))).toBeNull()
  })
})
