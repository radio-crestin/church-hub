interface ChordMapping {
  wordIndex: number
  chord: string
}

/**
 * Converts slide HTML content + chord mappings into HTML with chord annotations
 * displayed above the corresponding words.
 *
 * Each word that has a chord gets wrapped in a span with the chord displayed
 * above it using CSS positioning.
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

  // Parse HTML to lines of text, preserving structure
  // We need to work at the text level while preserving HTML tags
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

  // Split into words (preserving newlines as tokens for tracking)
  const lines = plainText.split('\n')
  let wordIndex = 0
  const resultLines: string[] = []

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean)
    const lineWords: string[] = []

    for (const word of words) {
      const chord = chordMap.get(wordIndex)
      if (chord) {
        // Wrap word with chord annotation
        lineWords.push(
          `<span style="display:inline-flex;flex-direction:column;align-items:center;margin:0 2px;vertical-align:bottom;">` +
            `<span style="font-size:0.65em;font-weight:bold;color:#f59e0b;line-height:1.2;min-height:1.2em;">${escapeHtml(chord)}</span>` +
            `<span>${escapeHtml(word)}</span>` +
            `</span>`,
        )
      } else {
        lineWords.push(
          `<span style="display:inline-flex;flex-direction:column;align-items:center;margin:0 2px;vertical-align:bottom;">` +
            `<span style="font-size:0.65em;line-height:1.2;min-height:1.2em;visibility:hidden;">&nbsp;</span>` +
            `<span>${escapeHtml(word)}</span>` +
            `</span>`,
        )
      }
      wordIndex++
    }
    // Add newline token for word index tracking
    wordIndex++
    resultLines.push(lineWords.join(' '))
  }

  return resultLines.join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
