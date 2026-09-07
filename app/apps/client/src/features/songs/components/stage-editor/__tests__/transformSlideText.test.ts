import { describe, expect, it } from 'vitest'

import { transformSlideText } from '../transformSlideText'

const TEXT = 'ACESTA ESTE UN TEXT\nAl DOILEA rând\nal treilea RÂND'

describe('transformSlideText', () => {
  it('lower-cases only what is selected', () => {
    expect(transformSlideText('ABC DEF', { start: 0, end: 3 }, 'lower')).toBe(
      'abc DEF',
    )
  })

  it('upper-cases only what is selected', () => {
    expect(transformSlideText('abc def', { start: 4, end: 7 }, 'upper')).toBe(
      'abc DEF',
    )
  })

  it('gives a shouted line one capital and nothing else', () => {
    expect(
      transformSlideText(
        'ACESTA ESTE UN TEXT',
        { start: 0, end: 19 },
        'sentence',
      ),
    ).toBe('Acesta este un text')
  })

  it('capitalises each line on its own', () => {
    expect(
      transformSlideText(TEXT, { start: 0, end: TEXT.length }, 'lineStart'),
    ).toBe('Acesta este un text\nAl doilea rând\nAl treilea rând')
  })

  it('capitalises past the punctuation a line opens with', () => {
    expect(
      transformSlideText('— IATĂ omul!', { start: 0, end: 12 }, 'sentence'),
    ).toBe('— Iată omul!')
  })

  it('handles Romanian diacritics in both directions', () => {
    const line = 'Cântă suflet al meu'
    expect(
      transformSlideText(line, { start: 0, end: line.length }, 'upper'),
    ).toBe('CÂNTĂ SUFLET AL MEU')
    expect(
      transformSlideText('CÂNTĂ SUFLET AL MEU', { start: 0, end: 19 }, 'lower'),
    ).toBe('cântă suflet al meu')
  })

  it('never changes how long the text is, so style runs keep their words', () => {
    for (const transform of [
      'lower',
      'upper',
      'sentence',
      'lineStart',
    ] as const) {
      const result = transformSlideText(
        TEXT,
        { start: 0, end: TEXT.length },
        transform,
      )
      expect(result).toHaveLength(TEXT.length)
    }
  })

  it('leaves a collapsed selection alone', () => {
    expect(transformSlideText(TEXT, { start: 5, end: 5 }, 'upper')).toBe(TEXT)
  })

  it('clamps a selection that runs past the end of the text', () => {
    expect(transformSlideText('abc', { start: 1, end: 99 }, 'upper')).toBe(
      'aBC',
    )
  })

  it('re-cases a selection that starts mid-line and ends mid-word', () => {
    const text = 'prima LINIE\na DOUA linie'
    expect(transformSlideText(text, { start: 6, end: 14 }, 'upper')).toBe(
      'prima LINIE\nA DOUA linie',
    )
  })

  it('keeps a line with no letters at all', () => {
    expect(transformSlideText('— — —', { start: 0, end: 5 }, 'sentence')).toBe(
      '— — —',
    )
  })
})
