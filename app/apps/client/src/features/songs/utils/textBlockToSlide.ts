import { isChordName } from './isChordName'
import { markdownToHtml } from './slidesMarkdown'
import type { ChordMapping, LocalSlide } from '../types'

type SlideText = Pick<LocalSlide, 'content' | 'chords' | 'label'>

const LABEL_LINE = /^#\s*(.+)$/
const BRACKETED = /\[([^\]\s]+)\]/g

/**
 * The inverse of `slideToTextBlock`: a block of the song's text back to a
 * slide's lyrics, chords and label. A chord in brackets belongs to the word it
 * stands before (or inside); one at the end of a line, to the line's last word.
 * Bracketed text that is not a chord name is kept as lyrics.
 */
export function textBlockToSlide(block: string): SlideText {
  const lines = block.split('\n').map((line) => line.trim())
  const labelMatch = lines[0] ? LABEL_LINE.exec(lines[0]) : null
  const lyricLines = (labelMatch ? lines.slice(1) : lines).filter(Boolean)

  const chords: ChordMapping[] = []
  let lineStart = 0
  const paragraphs = lyricLines.map((line) => {
    const pending: Array<{ chord: string; at: number }> = []
    let text = ''
    let last = 0
    for (const match of line.matchAll(BRACKETED)) {
      if (!isChordName(match[1])) continue
      text += line.slice(last, match.index)
      pending.push({ chord: match[1], at: text.length })
      last = match.index + match[0].length
    }
    text += line.slice(last)

    const wordStarts = [...text.matchAll(/\S+/g)].map((w) => ({
      start: w.index,
      end: w.index + w[0].length,
    }))
    for (const { chord, at } of pending) {
      if (wordStarts.length === 0) continue
      // The word the chord stands before, or the one it was written inside.
      let word = wordStarts.findIndex((w) => w.end > at)
      if (word < 0) word = wordStarts.length - 1
      chords.push({ wordIndex: lineStart + word, chord })
    }
    // The line break counts as a word.
    lineStart += wordStarts.length + 1
    return `<p>${markdownToHtml(text.replace(/\s+/g, ' ').trim())}</p>`
  })

  return {
    label: labelMatch ? labelMatch[1].trim() : null,
    content: paragraphs.join('') || '<p></p>',
    chords: chords.length > 0 ? chords : null,
  }
}
