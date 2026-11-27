/** Whether a line of the song's text ends a slide: blank, or `---`. */
export function isSlideSeparatorLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed === '' || trimmed === '---'
}
