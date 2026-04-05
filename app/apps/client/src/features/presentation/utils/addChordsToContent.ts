interface ChordMapping {
  wordIndex: number
  chord: string
}

/**
 * Converts slide HTML content + chord mappings into HTML with chord annotations
 * displayed above each line of lyrics.
 *
 * Output format: for each line, a chord line is placed above the lyrics line.
 * Chords are positioned using spaces to align above their corresponding words.
 * Chords have data-chord attribute for click detection.
 */
export function addChordsToContent(
  html: string,
  chords: ChordMapping[] | null | undefined,
): string {
  if (!chords || chords.length === 0) return html

  // Build chord lookup
  const chordMap = new Map<number, string>()
  for (const c of chords) {
    chordMap.set(c.wordIndex, c.chord)
  }

  // Parse HTML to plain text
  const plainText = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(p|div|h[1-6])[^>]*>/gi, '')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!plainText) return html

  const lines = plainText.split('\n')
  let wordIndex = 0
  const resultParts: string[] = []

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean)

    if (words.length === 0) {
      // Empty line
      wordIndex++
      resultParts.push('')
      continue
    }

    // Build chord line: position chords above their words using character offsets
    let hasChordOnLine = false
    const wordChords: Array<{ chord: string; charOffset: number }> = []
    let charPos = 0

    for (const word of words) {
      const chord = chordMap.get(wordIndex)
      if (chord) {
        hasChordOnLine = true
        wordChords.push({ chord, charOffset: charPos })
      }
      charPos += word.length + 1 // +1 for space
      wordIndex++
    }
    // Newline token
    wordIndex++

    if (hasChordOnLine) {
      // Build the chord line as positioned spans
      const chordSpans = wordChords
        .map(
          ({ chord }) =>
            `<span data-chord="${escapeAttr(chord)}" style="cursor:pointer;font-weight:bold;color:#f59e0b;margin-right:0.5em;">${escapeHtml(chord)}</span>`,
        )
        .join(' ')

      resultParts.push(chordSpans)
    }

    resultParts.push(escapeHtml(line))
  }

  return resultParts.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
