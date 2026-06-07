import { describe, expect, it } from 'vitest'

import {
  extractTrailingAmin,
  resolveAmen,
  resolveSongKey,
  resolveSongSlideBody,
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

describe('extractTrailingAmin', () => {
  it('extracts a standalone trailing "Amin!" paragraph', () => {
    expect(
      extractTrailingAmin('<p>Slăvit să fie El</p><p>Amin!</p>'),
    ).toEqual({ mainText: '<p>Slăvit să fie El</p>', amen: 'Amin!' })
  })

  it('extracts a trailing <br>-separated amin inside the last paragraph', () => {
    expect(extractTrailingAmin('<p>Slăvit<br>Amin!</p>')).toEqual({
      mainText: '<p>Slăvit</p>',
      amen: 'Amin!',
    })
  })

  it('extracts a multi-word amin line and keeps its text', () => {
    expect(
      extractTrailingAmin('<p>versul</p><p>Amin, Amin!</p>'),
    ).toEqual({ mainText: '<p>versul</p>', amen: 'Amin, Amin!' })
  })

  it('ignores trailing empty paragraphs before the amin', () => {
    expect(
      extractTrailingAmin('<p>versul</p><p>Amin!</p><p><br></p>'),
    ).toEqual({ mainText: '<p>versul</p>', amen: 'Amin!' })
  })

  it('handles a slide whose only line is an amin', () => {
    expect(extractTrailingAmin('<p>Amin!</p>')).toEqual({
      mainText: '',
      amen: 'Amin!',
    })
  })

  it('returns null when the last line is not a standalone amin', () => {
    expect(extractTrailingAmin('<p>line1</p><p>line2</p>')).toBeNull()
    expect(extractTrailingAmin('<p>versul</p><p>Slăvit, Amin</p>')).toBeNull()
  })
})

describe('resolveSongSlideBody', () => {
  it('leaves non-last slides untouched', () => {
    expect(resolveSongSlideBody(false, '<p>versul</p>')).toEqual({
      mainText: '<p>versul</p>',
      amen: undefined,
    })
  })

  it('pulls a trailing amin line into the amin element', () => {
    expect(
      resolveSongSlideBody(true, '<p>Slăvit să fie El</p><p>Amin!</p>'),
    ).toEqual({ mainText: '<p>Slăvit să fie El</p>', amen: 'Amin!' })
  })

  it('adds a standard "Amin!" when the last slide has no amin', () => {
    expect(resolveSongSlideBody(true, '<p>Slăvit să fie El</p>')).toEqual({
      mainText: '<p>Slăvit să fie El</p>',
      amen: 'Amin!',
    })
  })

  it('keeps an inline (non-trailing) amin in the lyrics without an element', () => {
    expect(
      resolveSongSlideBody(true, '<p>Amin slăvit</p><p>versul final</p>'),
    ).toEqual({ mainText: '<p>Amin slăvit</p><p>versul final</p>', amen: undefined })
  })
})
