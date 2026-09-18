import { describe, expect, it } from 'vitest'

import { buildGif } from '../../../../test/buildGif'
import { makeReadableFile } from '../../../../test/makeReadableFile'
import { findHeavyAnimatedGifs } from '../findHeavyAnimatedGifs'

const HEAVY = buildGif({ width: 1500, height: 1500, frames: 15 })
const LIGHT = buildGif({ width: 100, height: 100, frames: 5 })

describe('findHeavyAnimatedGifs', () => {
  it('lists only the heavy animated GIFs, with their name', async () => {
    const files = [
      makeReadableFile([LIGHT], 'light.gif', 'image/gif'),
      makeReadableFile([HEAVY], 'heavy.gif', 'image/gif'),
      makeReadableFile(['png'], 'still.png', 'image/png'),
    ]
    expect(await findHeavyAnimatedGifs(files)).toEqual([
      {
        name: 'heavy.gif',
        heavy: true,
        width: 1500,
        height: 1500,
        frameCount: 15,
        size: HEAVY.length,
      },
    ])
  })

  it('skips files the upload refuses anyway', async () => {
    const refused = makeReadableFile([HEAVY], 'heavy.gif.txt', 'text/plain')
    expect(await findHeavyAnimatedGifs([refused])).toEqual([])
  })

  it('finds nothing in an empty pick', async () => {
    expect(await findHeavyAnimatedGifs([])).toEqual([])
  })
})
