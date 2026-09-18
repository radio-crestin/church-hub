import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ScreenBackgroundConfig } from '../../../types'
import { ScreenBackground } from '../ScreenBackground'

vi.mock('~/config', () => ({
  getApiUrl: () => 'http://localhost:3000',
}))

const VIDEO_URL = '/api/media/backgrounds/loop.mp4'

describe('ScreenBackground', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
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

  it('shows a still frame without playing when playVideo is false', () => {
    render(
      <ScreenBackground
        background={{ type: 'video', videoUrl: VIDEO_URL, opacity: 1 }}
        playVideo={false}
      />,
    )
    const video = screen.getByTestId(
      'screen-background-video',
    ) as HTMLVideoElement
    expect(video.getAttribute('src')).toBe(
      `http://localhost:3000${VIDEO_URL}#t=0.1`,
    )
    expect(video.autoplay).toBe(false)
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })
})
