import { formatStyledMarkdown } from './formatStyledMarkdown'
import { parseStyledMarkdown } from './parseStyledMarkdown'
import { describe, expect, test } from 'bun:test'

const VERSE =
  'Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu.'

function rangeOf(text: string, words: string) {
  const start = text.indexOf(words)
  return { start, end: start + words.length }
}

describe('formatStyledMarkdown', () => {
  test('writes plain text unchanged', () => {
    expect(formatStyledMarkdown('Domnul este Păstorul meu', [])).toBe(
      'Domnul este Păstorul meu',
    )
  })

  test('writes bold, italic, underline and the default highlight', () => {
    const markdown = formatStyledMarkdown(VERSE, [
      { ...rangeOf(VERSE, 'Dumnezeu'), highlight: '#ffff00' },
      { ...rangeOf(VERSE, 'lumea'), underline: true },
      { ...rangeOf(VERSE, 'singurul'), bold: true },
      { ...rangeOf(VERSE, 'Fiu'), italic: true },
    ])

    expect(markdown).toBe(
      'Fiindcă atât de mult a iubit <mark>Dumnezeu</mark> <u>lumea</u>, că a dat pe **singurul** Lui *Fiu*.',
    )
  })

  test('writes another highlight colour as a mark tag', () => {
    expect(
      formatStyledMarkdown('a word', [
        { start: 2, end: 6, highlight: '#00ff00' },
      ]),
    ).toBe('a <mark style="background-color: #00FF00">word</mark>')
  })

  test('keeps overlapping ranges properly nested', () => {
    const markdown = formatStyledMarkdown(VERSE, [
      { ...rangeOf(VERSE, 'iubit Dumnezeu'), underline: true },
      { ...rangeOf(VERSE, 'Dumnezeu lumea'), highlight: '#FFFF00' },
    ])

    expect(markdown).toContain(
      '<u>iubit <mark>Dumnezeu</mark></u><mark> lumea</mark>',
    )
  })

  test('moves the markers off the spaces at the ends of a range', () => {
    expect(
      formatStyledMarkdown('a word here', [{ start: 1, end: 7, bold: true }]),
    ).toBe('a **word** here')
  })

  test('escapes characters that would read as styling', () => {
    const text =
      '2 * 3 = 6 <tag> _x_ # not a heading\n# nor this\n> nor a quote'
    const markdown = formatStyledMarkdown(text, [])
    expect(parseStyledMarkdown(markdown)).toEqual({ text, ranges: [] })
    expect(markdown).toContain('\n\\# nor this')
    expect(markdown).toContain('\n\\> nor a quote')
  })

  test('drops ranges that fall outside the text or hold only spaces', () => {
    expect(
      formatStyledMarkdown('a bc', [
        { start: 50, end: 60, bold: true },
        { start: 1, end: 2, underline: true },
      ]),
    ).toBe('a bc')
  })
})

describe('parseStyledMarkdown', () => {
  test('reads every style back to the same offsets', () => {
    const ranges = [
      { ...rangeOf(VERSE, 'Dumnezeu'), highlight: '#FFFF00' },
      { ...rangeOf(VERSE, 'lumea'), underline: true },
      { ...rangeOf(VERSE, 'singurul Lui'), bold: true },
      { ...rangeOf(VERSE, 'Fiu'), italic: true },
    ]

    const parsed = parseStyledMarkdown(formatStyledMarkdown(VERSE, ranges))

    expect(parsed.text).toBe(VERSE)
    expect(parsed.ranges).toEqual(
      ranges.sort((a, b) => a.start - b.start || a.end - b.end),
    )
  })

  test('reads the HTML spellings a person might type', () => {
    const parsed = parseStyledMarkdown(
      '<strong>a</strong> <em>b</em> <ins>c</ins> <mark style="background: #f00">d</mark>',
    )

    expect(parsed.text).toBe('a b c d')
    expect(parsed.ranges).toEqual([
      { start: 0, end: 1, bold: true },
      { start: 2, end: 3, italic: true },
      { start: 4, end: 5, underline: true },
      { start: 6, end: 7, highlight: '#F00' },
    ])
  })

  test('keeps an unclosed or spaced marker as plain text', () => {
    expect(parseStyledMarkdown('a * b')).toEqual({ text: 'a * b', ranges: [] })
    expect(parseStyledMarkdown('**open only').text).toBe('**open only')
    expect(parseStyledMarkdown('x </u> y').text).toBe('x </u> y')
  })

  test('reads the == highlight shorthand as the default colour', () => {
    expect(parseStyledMarkdown('a ==word==')).toEqual({
      text: 'a word',
      ranges: [{ start: 2, end: 6, highlight: '#FFFF00' }],
    })
  })

  test('keeps bold valid next to italic and spaces', () => {
    const text = 'singurul Lui Fiu'
    const markdown = formatStyledMarkdown(text, [
      { ...rangeOf(text, 'singurul Lui'), bold: true },
      { ...rangeOf(text, 'Lui Fiu'), italic: true },
    ])
    expect(markdown).toBe('**singurul *Lui*** *Fiu*')
    expect(parseStyledMarkdown(markdown).text).toBe(text)
  })

  test('keeps line breaks', () => {
    const parsed = parseStyledMarkdown('**line one**\nline two')
    expect(parsed.text).toBe('line one\nline two')
    expect(parsed.ranges).toEqual([{ start: 0, end: 8, bold: true }])
  })
})
