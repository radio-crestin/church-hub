import {
  parseOpenSongXml,
  removeHtmlTags,
  sanitizeSongTitle,
} from '@church-hub/song-formats'
import { expect, test } from '@playwright/test'

/**
 * The song-format parsers read files from anywhere (imports, song sources),
 * so they must stay linear on hostile input: the regexes they used to run
 * backtracked quadratically (CodeQL js/polynomial-redos), and a file of
 * repeated `<!--` or `<` could hang the server.
 */
const HUGE = 100_000
/** Quadratic code takes tens of seconds on these; linear takes milliseconds. */
const FAST_MS = 1_000

function timed<T>(run: () => T): { result: T; ms: number } {
  const start = performance.now()
  const result = run()
  return { result, ms: performance.now() - start }
}

test.describe('Song formats on hostile input', () => {
  test('removeHtmlTags is linear and removes tags as before', () => {
    expect(removeHtmlTags('<p>Har <b>și</b> pace</p>')).toBe('Har și pace')
    expect(removeHtmlTags('<p>a</p><p>b</p>', ' ')).toBe(' a  b ')
    // A removal never joins into a new tag; an unclosed `<` stays as text.
    expect(removeHtmlTags('<<b>script>x')).toBe('script>x')
    expect(removeHtmlTags('3 < 4 and <i>more')).toBe('3 more')
    expect(removeHtmlTags('a < b')).toBe('a < b')

    const { result, ms } = timed(() => removeHtmlTags('<'.repeat(HUGE)))
    expect(result).toBe('<'.repeat(HUGE))
    expect(ms).toBeLessThan(FAST_MS)
  })

  test('sanitizeSongTitle is linear and trims hyphens as before', () => {
    expect(sanitizeSongTitle('050 - Veniți creștini')).toBe('Veniți creștini')
    expect(sanitizeSongTitle('- Te-am ales -')).toBe('Te-am ales')
    expect(sanitizeSongTitle('---')).toBe('Untitled Song')

    const { ms } = timed(() => sanitizeSongTitle(`${'-a'.repeat(HUGE)}!`))
    expect(ms).toBeLessThan(FAST_MS)
  })

  test('parseOpenSongXml reads fields and survives hostile markup', () => {
    const song = parseOpenSongXml(
      `<song><title>Cântare <!-- note --> nouă<br /></title>
<author><![CDATA[Ion & <Maria>]]></author>
<lyrics>[V1]
 Laudă <i>Domnului</i>
</lyrics></song>`,
      'x.xml',
      { exactTitle: true },
    )
    expect(song.title).toBe('Cântare  nouă')
    expect(song.metadata.author).toBe('Ion & <Maria>')
    expect(song.verses).toEqual([{ label: 'V1', lines: ['Laudă Domnului'] }])

    for (const hostile of [
      `<song><title>${'<!--'.repeat(HUGE)}</title></song>`,
      `<song><title>${'<![CDATA['.repeat(HUGE)}</title></song>`,
      `<song><title>${'<'.repeat(HUGE)}</title></song>`,
      `<song>${'<title '.repeat(HUGE)}`,
      `<song>${'<title>'.repeat(HUGE)}`,
    ]) {
      const { result, ms } = timed(() => parseOpenSongXml(hostile, 'h.xml'))
      expect(result.title).toBeTruthy()
      expect(ms).toBeLessThan(FAST_MS)
    }
  })
})
