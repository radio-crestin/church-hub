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
  it('uses the first-slide layout for a first slide that has a gama', () => {
    expect(resolveSongSlideContentType(true, false, true, false)).toBe(
      'song_first_slide',
    )
  })

  it('falls back to song for a first slide WITHOUT a gama', () => {
    expect(resolveSongSlideContentType(true, false, false, false)).toBe('song')
  })

  it('uses the last-slide layout for a last slide that has an amin', () => {
    expect(resolveSongSlideContentType(false, true, false, true)).toBe(
      'song_last_slide',
    )
  })

  it('falls back to song for a last slide WITHOUT an amin', () => {
    expect(resolveSongSlideContentType(false, true, false, false)).toBe('song')
  })

  it('uses the plain song layout for middle slides', () => {
    expect(resolveSongSlideContentType(false, false, false, false)).toBe('song')
  })

  it('falls back to song for a single-slide song showing both gama and amin', () => {
    expect(resolveSongSlideContentType(true, true, true, true)).toBe('song')
  })

  it('uses the first-slide layout for a single slide with only a gama', () => {
    expect(resolveSongSlideContentType(true, true, true, false)).toBe(
      'song_first_slide',
    )
  })

  it('uses the last-slide layout for a single slide with only an amin', () => {
    expect(resolveSongSlideContentType(true, true, false, true)).toBe(
      'song_last_slide',
    )
  })
})
