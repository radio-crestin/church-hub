const VERSE_RUN_ONLY = /^\d+(?:\s*[-–—]\s*\d+)?$/

/**
 * Splits a "VT:" line of Edit as Text into its readings,
 * "Ana - Ioan 3:16-18,20, Ion - Ps 23:1" → ["Ana - Ioan 3:16-18,20", "Ion - Ps 23:1"].
 *
 * Readings are separated by commas, but a comma also continues a verse list.
 * A part that is only a verse or a verse range ("20", "20-22") belongs to the
 * reading before it.
 */
export function splitReadingList(content: string): string[] {
  const readings: string[] = []

  for (const part of content.split(',').map((piece) => piece.trim())) {
    const isVerseContinuation = readings.length > 0 && VERSE_RUN_ONLY.test(part)
    if (isVerseContinuation) {
      readings[readings.length - 1] += `,${part}`
    } else {
      readings.push(part)
    }
  }

  return readings
}
