import { foldTitle } from './foldTitle'
import { parseSongBookmarksText } from './parseSongBookmarksText'
import { describe, expect, test } from 'bun:test'

describe('parseSongBookmarksText', () => {
  test('reads the editor text: headings with ids, bare titles, notes', () => {
    const text = [
      '## Cât de mare ești {#song-12}',
      '> Final',
      'Har minunat',
      '- Isus e Domnul',
      '--- Rugăciune ---',
    ].join('\n')

    expect(parseSongBookmarksText(text)).toEqual([
      {
        kind: 'song',
        line: 1,
        content: '## Cât de mare ești {#song-12}',
        title: 'Cât de mare ești',
        songId: 12,
      },
      { kind: 'note', line: 2, content: 'Final' },
      {
        kind: 'song',
        line: 3,
        content: 'Har minunat',
        title: 'Har minunat',
        songId: undefined,
      },
      {
        kind: 'song',
        line: 4,
        content: '- Isus e Domnul',
        title: 'Isus e Domnul',
        songId: undefined,
      },
      { kind: 'note', line: 5, content: 'Rugăciune' },
    ])
  })

  test('skips the lyrics of the full export', () => {
    const text = [
      '## Lauda pe Domnul {#song-3}',
      '',
      '*Imnuri · Do*',
      '',
      '### Strofa 1',
      '',
      'Lauda **pe Domnul**, o, suflete',
      '',
      '> Final',
      '',
      '## Har minunat {#song-4}',
      '',
      '### 1',
      '',
      'Har minunat, ce dulce sună',
    ].join('\n')

    const result = parseSongBookmarksText(text)

    expect(result.map((entry) => entry.kind)).toEqual(['song', 'note', 'song'])
    expect(result.map((entry) => entry.line)).toEqual([1, 9, 11])
  })

  test('keeps a title typed after a blank line under a song', () => {
    const text = '## Cât de mare ești {#song-12}\n\nHar minunat'

    expect(parseSongBookmarksText(text).map((entry) => entry.kind)).toEqual([
      'song',
      'song',
    ])
  })

  test('unescapes a title written as Markdown', () => {
    const [entry] = parseSongBookmarksText('## Ce bine e \\*azi\\* {#song-9}')
    expect(entry).toMatchObject({ title: 'Ce bine e *azi*', songId: 9 })
  })

  test('ignores blank lines, document titles and separators', () => {
    expect(parseSongBookmarksText('# Marcaje\n\n---\n\n')).toEqual([])
  })
})

describe('foldTitle', () => {
  test('ignores case, diacritics and punctuation', () => {
    expect(foldTitle('  Cât de MARE  ești! ')).toBe(
      foldTitle('cat de mare esti'),
    )
  })
})
