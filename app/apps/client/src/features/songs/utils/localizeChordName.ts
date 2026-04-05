/**
 * Maps English chord root notes to Romanian solfège notation.
 * English: C  D  E  F  G  A  B
 * Romanian: Do Re Mi Fa Sol La Si
 */
const EN_TO_RO: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
}

const RO_TO_EN: Record<string, string> = {
  Do: 'C',
  Re: 'D',
  Mi: 'E',
  Fa: 'F',
  Sol: 'G',
  La: 'A',
  Si: 'B',
}

/**
 * Localizes a chord name for display based on the current language.
 * Chords are stored in English notation (C, D, E...) and translated
 * to solfège (Do, Re, Mi...) for Romanian.
 *
 * Examples (ro):
 *   "Am"   -> "Lam"
 *   "C#m7" -> "Do#m7"
 *   "Bb"   -> "Sib"
 *   "Gsus4" -> "Solsus4"
 */
export function localizeChordName(chord: string, language: string): string {
  if (language !== 'ro') return chord

  // Match the root note (with optional # or b)
  const match = chord.match(/^([A-G])(#|b)?(.*)$/)
  if (!match) return chord

  const [, root, accidental = '', suffix] = match
  const roRoot = EN_TO_RO[root]
  if (!roRoot) return chord

  return `${roRoot}${accidental}${suffix}`
}

/**
 * Converts a localized (Romanian) chord name back to English notation for storage.
 *
 * Examples:
 *   "Lam"     -> "Am"
 *   "Do#m7"   -> "C#m7"
 *   "Solsus4" -> "Gsus4"
 */
export function deLocalizeChordName(chord: string, language: string): string {
  if (language !== 'ro') return chord

  // Try each Romanian root (longest first to match "Sol" before "Si")
  const roots = Object.keys(RO_TO_EN).sort((a, b) => b.length - a.length)
  for (const roRoot of roots) {
    if (chord.startsWith(roRoot)) {
      const rest = chord.slice(roRoot.length)
      return `${RO_TO_EN[roRoot]}${rest}`
    }
  }

  return chord
}
