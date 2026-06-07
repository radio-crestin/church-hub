import { describe, expect, it } from 'vitest'

import {
  resolveAmen,
  resolveSongKey,
  resolveSongSlideContentType,
} from '../songElements'

describe('resolveSongKey', () => {
  it('returns the key only on the first slide', () => {
    expect(resolveSongKey(true, 'G', undefined)).toBe('G')
    expect(resolveSongKey(false, 'G', undefined)).toBeUndefined()
  })

  it('respects displayKeyLine=false', () => {
    expect(resolveSongKey(true, 'G', { displayKeyLine: false })).toBeUndefined()
    expect(resolveSongKey(true, 'G', { displayKeyLine: true })).toBe('G')
  })

  it('returns undefined when there is no key', () => {
    expect(resolveSongKey(true, null, undefined)).toBeUndefined()
    expect(resolveSongKey(true, '', undefined)).toBeUndefined()
    expect(resolveSongKey(true, '   ', undefined)).toBeUndefined()
  })

  it('trims the key value', () => {
    expect(resolveSongKey(true, '  Am  ', undefined)).toBe('Am')
  })
})

describe('resolveAmen', () => {
  it('returns "Amin!" only on the last slide', () => {
    expect(resolveAmen(true, 'Slăvit să fie El!')).toBe('Amin!')
    expect(resolveAmen(false, 'Slăvit să fie El!')).toBeUndefined()
  })

  it('is suppressed when the slide already contains "amin" (any case)', () => {
    expect(resolveAmen(true, 'Amin, Amin!')).toBeUndefined()
    expect(resolveAmen(true, '<p>amin</p>')).toBeUndefined()
    expect(resolveAmen(true, 'AMIN')).toBeUndefined()
  })
})

describe('resolveSongSlideContentType', () => {
  it('uses the first-slide layout for the first slide', () => {
    expect(resolveSongSlideContentType(true, false)).toBe('song_first_slide')
  })

  it('uses the last-slide layout for the last slide', () => {
    expect(resolveSongSlideContentType(false, true)).toBe('song_last_slide')
  })

  it('uses the plain song layout for middle slides', () => {
    expect(resolveSongSlideContentType(false, false)).toBe('song')
  })

  it('falls back to song for a single-slide song (both first and last)', () => {
    expect(resolveSongSlideContentType(true, true)).toBe('song')
  })
})
