import { describe, expect, it } from 'vitest'

import type { ContentTypeConfig } from '../../../../types'
import {
  getDefaultAnnouncementConfig,
  getDefaultBibleConfig,
  getDefaultEmptyConfig,
  getDefaultSongConfig,
  getDefaultVerseteTineriConfig,
} from '../../../../utils/defaultConfigs'
import { hasVisibleText } from '../hasVisibleText'

describe('hasVisibleText', () => {
  it('is true for a visible song slide with lyrics', () => {
    expect(
      hasVisibleText(getDefaultSongConfig(), { mainText: 'Verse' }, true),
    ).toBe(true)
  })

  it('is true for a Bible verse, versete tineri and an announcement', () => {
    expect(
      hasVisibleText(
        getDefaultBibleConfig(),
        { contentText: 'In the beginning', referenceText: 'Genesis 1:1' },
        true,
      ),
    ).toBe(true)
    expect(
      hasVisibleText(
        getDefaultVerseteTineriConfig(),
        { personLabel: 'Ana', contentText: 'Verse' },
        true,
      ),
    ).toBe(true)
    expect(
      hasVisibleText(
        getDefaultAnnouncementConfig(),
        { mainText: '<p>Welcome</p>' },
        true,
      ),
    ).toBe(true)
  })

  it('is false while the content is hidden', () => {
    expect(
      hasVisibleText(getDefaultSongConfig(), { mainText: 'Verse' }, false),
    ).toBe(false)
  })

  it('is false when there is nothing on screen', () => {
    expect(hasVisibleText(getDefaultEmptyConfig(), {}, true)).toBe(false)
    expect(hasVisibleText(getDefaultSongConfig(), null, true)).toBe(false)
    expect(hasVisibleText(getDefaultSongConfig(), { mainText: '' }, true)).toBe(
      false,
    )
  })

  it('is false for a scene, whose layout draws no text', () => {
    // A scene carries its id as text but has no layout of its own.
    expect(hasVisibleText(undefined, { mainText: '12' }, true)).toBe(false)
  })

  it('is false when the layout hides the element that has the text', () => {
    const song = getDefaultSongConfig()
    const config: ContentTypeConfig = {
      ...song,
      mainText: { ...song.mainText, hidden: true },
    }
    expect(hasVisibleText(config, { mainText: 'Verse' }, true)).toBe(false)
  })
})
