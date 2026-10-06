const OUTER_PUNCTUATION_RE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

/**
 * The words of folded text as written: split on whitespace, outer
 * punctuation trimmed, inner signs kept — "s-a" and "ne-ncetat" stay one
 * word, the way a reader counts them.
 */
export function splitWordUnits(foldedText: string): string[] {
  const units: string[] = []
  for (const raw of foldedText.split(/\s+/)) {
    const unit = raw.replace(OUTER_PUNCTUATION_RE, '')
    if (unit.length > 0) units.push(unit)
  }
  return units
}
