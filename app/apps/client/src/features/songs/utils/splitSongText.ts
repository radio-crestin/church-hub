import { isSlideSeparatorLine } from './isSlideSeparatorLine'

/**
 * The song's text cut into its slides' blocks: a blank line (or a `---` line,
 * as older texts have) ends a slide.
 */
export function splitSongText(text: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  for (const line of text.split('\n')) {
    if (isSlideSeparatorLine(line)) {
      if (current.length > 0) blocks.push(current.join('\n'))
      current = []
    } else {
      current.push(line.trim())
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'))
  return blocks
}
