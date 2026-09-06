import { describe, expect, it } from 'vitest'

import {
  containsAminWord,
  extractTrailingAmin,
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

describe('containsAminWord', () => {
  it('matches "amin" as a standalone word, any case', () => {
    expect(containsAminWord('Amin, Amin!')).toBe(true)
    expect(containsAminWord('<p>amin</p>')).toBe(true)
    expect(containsAminWord('AMIN')).toBe(true)
    expect(containsAminWord('vecii! Amin!')).toBe(true)
  })

  it('does NOT match words that merely contain "amin" (aminte, etc.)', () => {
    expect(containsAminWord('Adu-Ţi aminte, Doamne când Te chem')).toBe(false)
    expect(containsAminWord('ne-aducem aminte')).toBe(false)
    expect(containsAminWord('lumină')).toBe(false)
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
    expect(extractTrailingAmin('<p>Slăvit să fie El</p><p>Amin!</p>')).toEqual({
      mainText: '<p>Slăvit să fie El</p>',
      amen: 'Amin!',
    })
  })

  it('extracts a trailing <br>-separated amin inside the last paragraph', () => {
    expect(extractTrailingAmin('<p>Slăvit<br>Amin!</p>')).toEqual({
      mainText: '<p>Slăvit</p>',
      amen: 'Amin!',
    })
  })

  it('extracts a multi-word amin line and keeps its text', () => {
    expect(extractTrailingAmin('<p>versul</p><p>Amin, Amin!</p>')).toEqual({
      mainText: '<p>versul</p>',
      amen: 'Amin, Amin!',
    })
  })

  it('ignores trailing empty paragraphs before the amin', () => {
    expect(extractTrailingAmin('<p>versul</p><p>Amin!</p><p><br></p>')).toEqual(
      { mainText: '<p>versul</p>', amen: 'Amin!' },
    )
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
    ).toEqual({
      mainText: '<p>Amin slăvit</p><p>versul final</p>',
      amen: undefined,
    })
  })

  it('an "Amin" that ends the last sentence stays in the lyrics untouched', () => {
    const content = '<p>Să-mpart lumină şi dragoste-n vecii! Amin!</p>'
    expect(resolveSongSlideBody(true, content)).toEqual({
      mainText: content,
      amen: undefined,
    })
  })

  it('regression: "aminte" is not an amin — the last slide still gets one', () => {
    // "Adu-Ţi aminte, Doamne când Te chem": the substring test used to match
    // "aminte" and suppress the amin element (and the last-slide layout).
    const content =
      '<p>Adu-Ţi aminte, că-s făptura Ta,</p><p>Să-mpart lumină şi dragoste-n vecii!</p>'
    expect(resolveSongSlideBody(true, content)).toEqual({
      mainText: content,
      amen: 'Amin!',
    })
  })

  it('regression: a trailing amin line is extracted even when "aminte" appears above', () => {
    expect(
      resolveSongSlideBody(
        true,
        '<p>Adu-Ţi aminte, că-s făptura Ta,</p><p>Amin,</p>',
      ),
    ).toEqual({
      mainText: '<p>Adu-Ţi aminte, că-s făptura Ta,</p>',
      amen: 'Amin,',
    })
  })

  it('uses a custom amin label instead of the default "Amin!"', () => {
    expect(
      resolveSongSlideBody(true, '<p>Slăvit să fie El</p>', 'Slăvit!'),
    ).toEqual({ mainText: '<p>Slăvit să fie El</p>', amen: 'Slăvit!' })
  })

  it('a custom amin label overrides an extracted trailing amin line', () => {
    expect(
      resolveSongSlideBody(
        true,
        '<p>Slăvit să fie El</p><p>Amin!</p>',
        'Amin.',
      ),
    ).toEqual({ mainText: '<p>Slăvit să fie El</p>', amen: 'Amin.' })
  })

  it('ignores a blank custom amin label (falls back to default)', () => {
    expect(
      resolveSongSlideBody(true, '<p>Slăvit să fie El</p>', '   '),
    ).toEqual({ mainText: '<p>Slăvit să fie El</p>', amen: 'Amin!' })
  })
})
