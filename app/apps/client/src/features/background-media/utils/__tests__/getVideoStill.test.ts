import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureVideoStill } from '../captureVideoStill'
import { getVideoStill } from '../getVideoStill'

vi.mock('../captureVideoStill', () => ({
  captureVideoStill: vi.fn(),
}))

// The cache lives for the page, so every test uses videos of its own.
let nextId = 0
const uniqueSrc = () =>
  `http://localhost:3000/api/media/backgrounds/${++nextId}.mp4`

describe('getVideoStill', () => {
  beforeEach(() => {
    vi.mocked(captureVideoStill).mockReset()
    vi.mocked(captureVideoStill).mockImplementation(async () =>
      document.createElement('canvas'),
    )
  })

  it('captures a video once however many thumbnails ask for it', async () => {
    const src = uniqueSrc()
    const stills = Array.from({ length: 30 }, () => getVideoStill(src))

    expect(captureVideoStill).toHaveBeenCalledTimes(1)
    const [first, ...rest] = await Promise.all(stills)
    for (const still of rest) expect(still).toBe(first)
  })

  it('captures each video separately', async () => {
    await Promise.all([getVideoStill(uniqueSrc()), getVideoStill(uniqueSrc())])
    expect(captureVideoStill).toHaveBeenCalledTimes(2)
  })

  it('tries again after a failed capture', async () => {
    const src = uniqueSrc()
    vi.mocked(captureVideoStill).mockRejectedValueOnce(new Error('offline'))

    await expect(getVideoStill(src)).rejects.toThrow('offline')
    await expect(getVideoStill(src)).resolves.toBeInstanceOf(HTMLCanvasElement)
    expect(captureVideoStill).toHaveBeenCalledTimes(2)
  })
})
