/**
 * A chord name as the songs store it: a note (A–H), an optional sharp or flat,
 * then the usual quality marks (m, maj7, sus4, dim, add9, …) and an optional
 * bass note. Text in brackets that is not one ("[x2]", "[Refren]") stays text.
 */
const CHORD_NAME =
  /^[A-H][#b]?(?:maj|min|m|M|dim|aug|sus|add|[0-9]|\+|°|ø|\(|\)|#|b)*(?:\/[A-H][#b]?)?$/

export function isChordName(text: string): boolean {
  return CHORD_NAME.test(text)
}
