/** A stretch of a slide's text, from `start` up to (not including) `end`. */
export type TextSpan = [start: number, end: number]

function countLines(text: string | undefined): Map<string, number> {
  const counts = new Map<string, number>()
  for (const line of text?.split('\n') ?? []) {
    const key = line.trim()
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * The lines a typewriter types, in reading order: every line of `text` but
 * those the slide before it also showed, which stay on screen at once.
 */
export function typedSpans(text: string, previousText?: string): TextSpan[] {
  const alreadyShown = countLines(previousText)
  const spans: TextSpan[] = []
  let start = 0
  for (const line of text.split('\n')) {
    const end = start + line.length
    const shownBefore = alreadyShown.get(line.trim()) ?? 0
    if (shownBefore > 0) alreadyShown.set(line.trim(), shownBefore - 1)
    else if (end > start) spans.push([start, end])
    start = end + 1
  }
  return spans
}
