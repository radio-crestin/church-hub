import { describe, expect, it } from 'vitest'

import type {
  ContentType,
  ScreenBackgroundConfig,
  ScreenType,
  ScreenWithConfigs,
} from '../../types'
import { resolveScreenBackground } from '../resolveScreenBackground'

const SONG_BG: ScreenBackgroundConfig = {
  type: 'color',
  color: '#111111',
  opacity: 1,
}
const FIRST_SLIDE_BG: ScreenBackgroundConfig = {
  type: 'color',
  color: '#222222',
  opacity: 1,
}
const BIBLE_BG: ScreenBackgroundConfig = {
  type: 'color',
  color: '#333333',
  opacity: 1,
}
const EMPTY_BG: ScreenBackgroundConfig = {
  type: 'color',
  color: '#444444',
  opacity: 1,
}
const OWN_BG: ScreenBackgroundConfig = {
  type: 'image',
  imageUrl: '/api/media/backgrounds/own.png',
  opacity: 0.8,
}

function makeScreen(
  type: ScreenType,
): Pick<ScreenWithConfigs, 'type' | 'contentConfigs'> {
  return {
    type,
    contentConfigs: {
      song: { background: SONG_BG },
      song_first_slide: { background: FIRST_SLIDE_BG },
      song_last_slide: { background: SONG_BG },
      bible: { background: BIBLE_BG },
      empty: { background: EMPTY_BG },
    } as unknown as ScreenWithConfigs['contentConfigs'],
  }
}

describe('resolveScreenBackground', () => {
  it.each<[ScreenType, ContentType]>([
    ['primary', 'song'],
    ['primary', 'song_first_slide'],
    ['primary', 'song_last_slide'],
    ['kiosk', 'song'],
  ])('uses the background set on the song on a %s screen for %s', (type, contentType) => {
    expect(
      resolveScreenBackground({
        screen: makeScreen(type),
        contentType,
        contentData: { songBackground: OWN_BG },
      }),
    ).toBe(OWN_BG)
  })

  it.each<ScreenType>([
    'stage',
    'livestream',
  ])('keeps the %s screen background for a song', (type) => {
    expect(
      resolveScreenBackground({
        screen: makeScreen(type),
        contentType: 'song',
        contentData: { songBackground: OWN_BG },
      }),
    ).toBe(SONG_BG)
  })

  it('uses the layout background when the song has none', () => {
    expect(
      resolveScreenBackground({
        screen: makeScreen('primary'),
        contentType: 'song_first_slide',
        contentData: { songBackground: null },
      }),
    ).toBe(FIRST_SLIDE_BG)
  })

  it('ignores a song background on content that is not a song slide', () => {
    expect(
      resolveScreenBackground({
        screen: makeScreen('primary'),
        contentType: 'empty',
        contentData: { songBackground: OWN_BG },
      }),
    ).toBe(EMPTY_BG)
  })

  it('uses the content type background for other content', () => {
    expect(
      resolveScreenBackground({
        screen: makeScreen('primary'),
        contentType: 'bible',
        contentData: {},
      }),
    ).toBe(BIBLE_BG)
  })

  it('falls back to the empty background when the type has none', () => {
    expect(
      resolveScreenBackground({
        screen: makeScreen('primary'),
        contentType: 'announcement',
        contentData: {},
      }),
    ).toBe(EMPTY_BG)
  })
})
