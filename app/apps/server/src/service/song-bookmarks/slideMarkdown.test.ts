import { formatSongHeading } from './formatSongHeading'
import { slideMarkdown } from './slideMarkdown'
import { describe, expect, test } from 'bun:test'

describe('slideMarkdown', () => {
  test('turns slide HTML into lyrics lines', () => {
    expect(
      slideMarkdown('<p>Lauda pe Domnul,</p><p>o, suflete&#039;</p>', null),
    ).toBe("Lauda pe Domnul,\no, suflete'")
  })

  test('writes the styled words at the offsets the screens use', () => {
    const overrides = JSON.stringify({
      ranges: [
        { start: 6, end: 8, bold: true },
        { start: 20, end: 27, underline: true },
      ],
    })

    expect(
      slideMarkdown('<p>Lauda pe Domnul,</p><p>o, suflete</p>', overrides),
    ).toBe('Lauda **pe** Domnul,\no, <u>suflete</u>')
  })

  test('styles the whole slide when the slide itself is bold', () => {
    expect(
      slideMarkdown('<p>Aleluia</p>', JSON.stringify({ bold: true })),
    ).toBe('**Aleluia**')
  })
})

describe('formatSongHeading', () => {
  test('carries the song id as a heading attribute', () => {
    expect(formatSongHeading(' Ce bine e *azi* ', 12)).toBe(
      '## Ce bine e \\*azi\\* {#song-12}',
    )
  })
})
