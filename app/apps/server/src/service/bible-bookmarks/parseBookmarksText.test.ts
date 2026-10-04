import { parseBookmarksText } from './parseBookmarksText'
import { describe, expect, test } from 'bun:test'

describe('parseBookmarksText', () => {
  test('returns nothing for empty input', () => {
    expect(parseBookmarksText('')).toEqual([])
    expect(parseBookmarksText('   \n\n  \n')).toEqual([])
  })

  test('reads a bare reference', () => {
    const result = parseBookmarksText('Ioan 3:16')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      kind: 'verse',
      line: 1,
      reference: 'Ioan 3:16',
      translationAbbreviation: undefined,
    })
  })

  test('splits off a trailing translation abbreviation', () => {
    const result = parseBookmarksText('Ioan 3:16 - RCCV')

    expect(result[0]).toMatchObject({
      kind: 'verse',
      reference: 'Ioan 3:16',
      translationAbbreviation: 'RCCV',
    })
  })

  test('keeps a cross-chapter range intact', () => {
    // "- 2:5" must not be mistaken for a translation abbreviation
    const result = parseBookmarksText('Gen 1:1 - 2:5')

    expect(result[0]).toMatchObject({
      kind: 'verse',
      reference: 'Gen 1:1 - 2:5',
      translationAbbreviation: undefined,
    })
  })

  test('keeps a same-chapter range intact', () => {
    const result = parseBookmarksText('Ioan 3:16-18 - RCCV')

    expect(result[0]).toMatchObject({
      reference: 'Ioan 3:16-18',
      translationAbbreviation: 'RCCV',
    })
  })

  test('reads a numbered book', () => {
    const result = parseBookmarksText('1 Ioan 4:8')

    expect(result[0]).toMatchObject({ reference: '1 Ioan 4:8' })
  })

  test('reads notes wrapped in dashes', () => {
    const result = parseBookmarksText('--- Predica de duminica ---')

    expect(result).toEqual([
      { kind: 'note', line: 1, content: 'Predica de duminica' },
    ])
  })

  test('ignores a bare separator and empty notes', () => {
    expect(parseBookmarksText('---\n--- ---')).toEqual([])
  })

  test('ignores indented verse text', () => {
    const text = [
      'Ioan 3:16 - RCCV',
      '    Fiindca atat de mult a iubit Dumnezeu lumea',
      '\tcontinuare indentata',
    ].join('\n')

    const result = parseBookmarksText(text)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ reference: 'Ioan 3:16' })
  })

  test('ignores comment lines', () => {
    expect(parseBookmarksText('# just a comment\nIoan 3:16')).toHaveLength(1)
  })

  test('reports the original line number of every entry', () => {
    const text = [
      '# header',
      '',
      '--- Chemare ---',
      '',
      'Ioan 3:16 - RCCV',
      '    text of the verse',
      '',
      'Psalmi 23:1',
    ].join('\n')

    const result = parseBookmarksText(text)

    expect(result.map((entry) => entry.line)).toEqual([3, 5, 8])
    expect(result.map((entry) => entry.kind)).toEqual([
      'note',
      'verse',
      'verse',
    ])
  })

  test('handles CRLF line endings', () => {
    const result = parseBookmarksText('Ioan 3:16\r\nPsalmi 23:1\r\n')

    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ reference: 'Psalmi 23:1' })
  })

  test('reads the Markdown export: heading, styled verse, quoted note', () => {
    const text = [
      '## Ioan 3:16 - RCCV',
      '',
      'Fiindcă atât de mult a iubit <mark>Dumnezeu</mark> <u>lumea</u>',
      '',
      '> Chemare',
      '',
      '## Psalmi 23:1',
      '',
      'Domnul este **Păstorul** meu',
    ].join('\n')

    expect(parseBookmarksText(text)).toEqual([
      {
        kind: 'verse',
        line: 1,
        content: 'Ioan 3:16 - RCCV',
        reference: 'Ioan 3:16',
        translationAbbreviation: 'RCCV',
        markdown:
          'Fiindcă atât de mult a iubit <mark>Dumnezeu</mark> <u>lumea</u>',
        markdownLine: 3,
      },
      { kind: 'note', line: 5, content: 'Chemare' },
      {
        kind: 'verse',
        line: 7,
        content: 'Psalmi 23:1',
        reference: 'Psalmi 23:1',
        translationAbbreviation: undefined,
        markdown: 'Domnul este **Păstorul** meu',
        markdownLine: 9,
      },
    ])
  })

  test('reads bare references after a heading and its verse', () => {
    const text = ['## Ioan 3:16', 'Fiindcă', '', 'Psalmi 23:1'].join('\n')

    const result = parseBookmarksText(text)

    expect(result).toHaveLength(2)
    expect(result[1]).toMatchObject({ reference: 'Psalmi 23:1' })
    expect(result[1]).not.toHaveProperty('markdown')
  })

  test('skips a document title', () => {
    expect(parseBookmarksText('# Marcaje\n\nIoan 3:16')).toHaveLength(1)
  })
})
