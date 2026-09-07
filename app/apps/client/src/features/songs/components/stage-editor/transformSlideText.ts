/** The case changes the formatting bar offers for a selection. */
export type TextTransform = 'lower' | 'upper' | 'sentence' | 'lineStart'

/**
 * Re-cases the selected part of a slide's text, leaving the rest alone.
 *
 * A slide's styling lives beside its text as character offsets, so a transform
 * that changed the length of the selection would move every run after it. Each
 * character is therefore mapped on its own and kept as it was whenever the
 * mapping would not be one for one — the text stays exactly as long as it was,
 * and the styling still points at the words it was put on.
 */
export function transformSlideText(
  text: string,
  selection: { start: number; end: number },
  transform: TextTransform,
): string {
  const start = Math.max(0, Math.min(selection.start, text.length))
  const end = Math.max(start, Math.min(selection.end, text.length))
  if (start === end) return text

  return (
    text.slice(0, start) +
    transformSegment(text.slice(start, end), transform) +
    text.slice(end)
  )
}

function transformSegment(segment: string, transform: TextTransform): string {
  switch (transform) {
    case 'upper':
      return mapCase(segment, true)
    case 'lower':
      return mapCase(segment, false)
    case 'sentence':
      return capitaliseFirstLetter(mapCase(segment, false))
    case 'lineStart':
      // Each line is a verse of its own, so each gets its own capital.
      return segment
        .split('\n')
        .map((line) => capitaliseFirstLetter(mapCase(line, false)))
        .join('\n')
  }
}

/** Upper- or lower-cases `text` without ever changing how long it is. */
function mapCase(text: string, toUpper: boolean): string {
  let result = ''
  for (const char of text) {
    const mapped = toUpper ? char.toLocaleUpperCase() : char.toLocaleLowerCase()
    result += mapped.length === char.length ? mapped : char
  }
  return result
}

/** Upper-cases the first letter, whatever punctuation comes before it. */
function capitaliseFirstLetter(text: string): string {
  const match = text.match(/\p{L}/u)
  if (!match || match.index === undefined) return text
  const letter = match[0]
  return (
    text.slice(0, match.index) +
    mapCase(letter, true) +
    text.slice(match.index + letter.length)
  )
}
