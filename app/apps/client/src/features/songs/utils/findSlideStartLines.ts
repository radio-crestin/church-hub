import { isSlideSeparatorLine } from './isSlideSeparatorLine'

/**
 * The line each slide of the song's text starts on, by the same rule as
 * `splitSongText`. Cheap enough to run on every keystroke of a long song.
 */
export function findSlideStartLines(text: string): number[] {
  const starts: number[] = []
  let inSlide = false
  let line = 0
  let lineStart = 0
  for (let i = 0; i <= text.length; i += 1) {
    if (i < text.length && text[i] !== '\n') continue
    const separator = isSlideSeparatorLine(text.slice(lineStart, i))
    if (!separator && !inSlide) starts.push(line)
    inSlide = !separator
    line += 1
    lineStart = i + 1
  }
  return starts
}
