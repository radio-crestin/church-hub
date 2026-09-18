import { describe, expect, it } from 'vitest'

import type {
  ContentType,
  ScreenBackgroundConfig,
  ScreenType,
  ScreenWithConfigs,
} from '~/features/presentation/types'
import { hasMediaPreviewBackground } from '../hasMediaPreviewBackground'

const COLOR: ScreenBackgroundConfig = {
  type: 'color',
  color: '#123456',
  opacity: 1,
}
const IMAGE: ScreenBackgroundConfig = {
  type: 'image',
  imageUrl: '/api/media/backgrounds/a.png',
  color: '#000000',
  opacity: 1,
}
const VIDEO: ScreenBackgroundConfig = {
  type: 'video',
  videoUrl: '/api/media/backgrounds/b.webm',
  color: '#000000',
  opacity: 1,
}

/** A screen with just the given backgrounds, by content type. */
function makeScreen(
  type: ScreenType,
  backgrounds: Partial<Record<ContentType, ScreenBackgroundConfig>> = {},
): Pick<ScreenWithConfigs, 'type' | 'contentConfigs'> {
  const contentConfigs = Object.fromEntries(
    Object.entries(backgrounds).map(([contentType, background]) => [
      contentType,
      { background },
    ]),
  )
  return {
    type,
    contentConfigs: contentConfigs as ScreenWithConfigs['contentConfigs'],
  }
}

describe('hasMediaPreviewBackground', () => {
  it('is false while there is no preview screen', () => {
    expect(hasMediaPreviewBackground(undefined, IMAGE)).toBe(false)
  })

  it('follows the song background on a primary or kiosk screen', () => {
    for (const type of ['primary', 'kiosk'] as const) {
      const screen = makeScreen(type, { song: COLOR })
      expect(hasMediaPreviewBackground(screen, IMAGE)).toBe(true)
      expect(hasMediaPreviewBackground(screen, VIDEO)).toBe(true)
    }
  })

  it('lets a colour song background hide the screen media', () => {
    const screen = makeScreen('primary', {
      song: IMAGE,
      song_first_slide: VIDEO,
      song_last_slide: IMAGE,
    })
    expect(hasMediaPreviewBackground(screen, COLOR)).toBe(false)
  })

  it('uses the screen song backgrounds when the song has none', () => {
    expect(
      hasMediaPreviewBackground(makeScreen('primary', { song: COLOR }), null),
    ).toBe(false)
    expect(
      hasMediaPreviewBackground(makeScreen('primary', { song: IMAGE }), null),
    ).toBe(true)
  })

  it('counts media on any of the song layouts', () => {
    const firstOnly = makeScreen('primary', {
      song: COLOR,
      song_first_slide: VIDEO,
    })
    const lastOnly = makeScreen('primary', {
      song: COLOR,
      song_last_slide: IMAGE,
    })
    expect(hasMediaPreviewBackground(firstOnly, null)).toBe(true)
    expect(hasMediaPreviewBackground(lastOnly, null)).toBe(true)
  })

  it('falls back to the empty background for a layout without one', () => {
    expect(
      hasMediaPreviewBackground(makeScreen('primary', { empty: IMAGE }), null),
    ).toBe(true)
  })

  it('ignores the song background on stage and livestream screens', () => {
    for (const type of ['stage', 'livestream'] as const) {
      const screen = makeScreen(type, { song: COLOR })
      expect(hasMediaPreviewBackground(screen, IMAGE)).toBe(false)
    }
  })

  it('does not count an image or video without a file', () => {
    const screen = makeScreen('primary', { song: COLOR })
    expect(
      hasMediaPreviewBackground(screen, { type: 'image', opacity: 1 }),
    ).toBe(false)
    expect(
      hasMediaPreviewBackground(screen, { type: 'video', opacity: 1 }),
    ).toBe(false)
  })
})
