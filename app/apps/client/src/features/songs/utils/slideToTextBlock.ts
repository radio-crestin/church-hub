import { htmlToMarkdown } from './slidesMarkdown'
import type { LocalSlide } from '../types'

/**
 * One slide as a block of the song's text: an optional `#label` line, then
 * its lyrics with each chord written in brackets before its word (`[G]grace`).
 *
 * Chords are stored by word position, counting each line break as one word,
 * the way the screens place them. Blank lines inside a slide are left out: in
 * the text a blank line starts the next slide.
 */
export function slideToTextBlock(slide: LocalSlide): string {
  const chordAt = new Map(
    (slide.chords ?? []).map((c) => [c.wordIndex, c.chord] as const),
  )
  let wordIndex = 0
  const lines: string[] = []
  for (const line of htmlToMarkdown(slide.content).split('\n')) {
    const withChords = line.replace(/\S+/g, (word) => {
      const chord = chordAt.get(wordIndex)
      wordIndex += 1
      return chord ? `[${chord}]${word}` : word
    })
    // The line break counts as a word.
    wordIndex += 1
    if (withChords.trim()) lines.push(withChords.trim())
  }
  const label = slide.label?.trim()
  return [...(label ? [`#${label}`] : []), ...lines].join('\n')
}
