import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { captureVideoStill } from '../captureVideoStill'

const SRC = 'http://localhost:3000/api/media/backgrounds/loop.mp4'

/** The <video> the capture creates, with the frame size a decoder reports. */
function capturedVideo(width: number, height: number): HTMLVideoElement {
  const video = vi
    .mocked(document.createElement)
    .mock.results.find((result) => result.value instanceof HTMLVideoElement)
    ?.value as HTMLVideoElement
  Object.defineProperty(video, 'videoWidth', { value: width })
  Object.defineProperty(video, 'videoHeight', { value: height })
  return video
}

const drawImage = vi.fn()

describe('captureVideoStill', () => {
  beforeEach(() => {
    drawImage.mockReset()
    vi.spyOn(document, 'createElement')
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('draws the first playable frame, scaled down, and lets the player go', async () => {
    const still = captureVideoStill(SRC)
    const video = capturedVideo(1920, 1080)
    expect(video.getAttribute('src')).toBe(SRC)
    expect(video.muted).toBe(true)

    video.dispatchEvent(new Event('canplay'))
    const canvas = await still

    expect(canvas).toBeInstanceOf(HTMLCanvasElement)
    expect([canvas.width, canvas.height]).toEqual([640, 360])
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360)
    // Source dropped and reloaded: the download stops, the decoder is freed.
    expect(video.hasAttribute('src')).toBe(false)
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1)
  })

  it('keeps a small video at its own size', async () => {
    const still = captureVideoStill(SRC)
    capturedVideo(160, 90).dispatchEvent(new Event('canplay'))
    const canvas = await still
    expect([canvas.width, canvas.height]).toEqual([160, 90])
  })

  it('rejects and releases the player when the video cannot load', async () => {
    const still = captureVideoStill(SRC)
    const video = capturedVideo(0, 0)
    video.dispatchEvent(new Event('error'))

    await expect(still).rejects.toThrow(SRC)
    expect(video.hasAttribute('src')).toBe(false)
    expect(drawImage).not.toHaveBeenCalled()
  })
})
