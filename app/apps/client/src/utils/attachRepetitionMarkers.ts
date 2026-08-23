/**
 * Romanian hymnals close a repeated stanza with a marker glued to the end of
 * its last verse line: `/: … :/`, `//: … ://`, `|: … :|`, or a count like
 * `(x2)` / `bis`. The marker belongs to that line and must never be read as a
 * line of its own.
 */
const REPETITION_MARKER =
  '(?:[/|]{1,2}:|:[/|]{1,2}|\\(?\\s*(?:x\\s*\\d+|\\d+\\s*x|bis)\\s*\\)?)'

/** A line that is nothing but a marker — the shape a few imported slides have. */
const MARKER_ONLY_LINE = new RegExp(`^\\s*${REPETITION_MARKER}\\s*$`, 'i')

/** A marker sitting at the end of a line, with the whitespace before it. */
const TRAILING_MARKER = new RegExp(`[ \\t]+(${REPETITION_MARKER})[ \\t]*$`, 'i')

/** Non-breaking space — keeps the marker on the same rendered row as the verse. */
const NBSP = '\u00a0'

/**
 * Keeps repetition markers on the same line as the verse they close.
 *
 * Two things push a marker onto its own line, and this fixes both:
 * - a marker stored as its own line (a handful of imported slides do this) is
 *   merged into the line above it;
 * - the ordinary space before a trailing marker is a break opportunity, so a
 *   long stanza wraps the marker down on its own. Swapping that space for a
 *   non-breaking one makes the marker travel with the last word instead.
 *
 * Operates on plain, newline-separated lyrics — call it after slide HTML has
 * been turned into text.
 */
export function attachRepetitionMarkers(text: string): string {
  const lines = text.split('\n')
  const merged: string[] = []

  for (const line of lines) {
    const previous = merged[merged.length - 1]
    if (MARKER_ONLY_LINE.test(line) && previous?.trim()) {
      merged[merged.length - 1] = `${previous.trimEnd()}${NBSP}${line.trim()}`
      continue
    }
    merged.push(line)
  }

  return merged
    .map((line) => line.replace(TRAILING_MARKER, `${NBSP}$1`))
    .join('\n')
}
