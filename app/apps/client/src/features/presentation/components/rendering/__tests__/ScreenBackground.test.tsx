import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureVideoStill } from '~/features/background-media/utils/captureVideoStill'
import type { ScreenBackgroundConfig } from '../../../types'
import { ScreenBackground } from '../ScreenBackground'

vi.mock('~/config', () => ({
  getApiUrl: () => 'http://localhost:3000',
}))

vi.mock('~/features/background-media/utils/captureVideoStill', () => ({
  captureVideoStill: vi.fn(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 36
    return canvas
  }),
}))

const VIDEO_URL = '/api/media/backgrounds/loop.mp4'
/** A video no other test captures (stills are cached for the page). */
const FILMSTRIP_VIDEO_URL = '/api/media/backgrounds/filmstrip.mp4'

const drawImage = vi.fn()

describe('ScreenBackground', () => {
  beforeEach(() => {
    drawImage.mockReset()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
  })

  it('renders nothing for a transparent background', () => {
    const { container } = render(
      <ScreenBackground background={{ type: 'transparent', opacity: 1 }} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('falls back to black when there is no background', () => {
    render(<ScreenBackground background={undefined} />)
    expect(screen.getByTestId('screen-background').style.backgroundColor).toBe(
      'rgb(0, 0, 0)',
    )
  })

  it('puts a colour background opacity on the layer only', () => {
    render(
      <ScreenBackground
        background={{ type: 'color', color: '#ff0000', opacity: 0.5 }}
      />,
    )
    const layer = screen.getByTestId('screen-background')
    expect(layer.dataset.backgroundType).toBe('color')
    expect(layer.style.opacity).toBe('0.5')
  })

  it('dims a resolved image against the base colour', () => {
    render(
      <ScreenBackground
        background={{
          type: 'image',
          imageUrl: '/api/media/backgrounds/bg.png',
          opacity: 0.4,
        }}
      />,
    )
    const image = screen.getByTestId('screen-background-image')
    expect(image.style.backgroundImage).toContain(
      'http://localhost:3000/api/media/backgrounds/bg.png',
    )
    expect(image.style.opacity).toBe('0.4')
  })

  it('keeps the same video element across content types sharing the video', () => {
    const song: ScreenBackgroundConfig = {
      type: 'video',
      videoUrl: VIDEO_URL,
      opacity: 1,
    }
    const { rerender } = render(<ScreenBackground background={song} />)
    const first = screen.getByTestId('screen-background-video')
    expect(first.getAttribute('src')).toBe(`http://localhost:3000${VIDEO_URL}`)

    rerender(<ScreenBackground background={{ ...song, opacity: 0.8 }} />)
    expect(screen.getByTestId('screen-background-video')).toBe(first)
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1)
  })

  it('shows a still frame without playing when playVideo is false', async () => {
    render(
      <ScreenBackground
        background={{ type: 'video', videoUrl: VIDEO_URL, opacity: 0.6 }}
        playVideo={false}
      />,
    )
    const still = screen.getByTestId('screen-background-video-still')
    expect(still.tagName).toBe('CANVAS')
    expect(still.style.opacity).toBe('0.6')
    expect(screen.queryByTestId('screen-background-video')).toBeNull()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
    await waitFor(() => expect(still.dataset.ready).toBe('true'))
    expect([
      (still as HTMLCanvasElement).width,
      (still as HTMLCanvasElement).height,
    ]).toEqual([64, 36])
    expect(drawImage).toHaveBeenCalledTimes(1)
  })

  it('gives a filmstrip of thumbnails one capture, not a player each', async () => {
    const src = `http://localhost:3000${FILMSTRIP_VIDEO_URL}`
    const { container } = render(
      <>
        {Array.from({ length: 30 }, (_, slide) => (
          <ScreenBackground
            key={slide}
            background={{
              type: 'video',
              videoUrl: FILMSTRIP_VIDEO_URL,
              opacity: 1,
            }}
            playVideo={false}
          />
        ))}
      </>,
    )

    expect(container.querySelectorAll('video')).toHaveLength(0)
    const stills = screen.getAllByTestId('screen-background-video-still')
    expect(stills).toHaveLength(30)
    await waitFor(() =>
      expect(stills.every((still) => still.dataset.ready === 'true')).toBe(
        true,
      ),
    )
    const captures = vi
      .mocked(captureVideoStill)
      .mock.calls.filter(([url]) => url === src)
    expect(captures).toHaveLength(1)
  })
})
