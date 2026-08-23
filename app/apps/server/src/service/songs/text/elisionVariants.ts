/**
 * The spellings of a word that differ by an elided "î". In Romanian songs a
 * short clitic (1–2 letters, vowel-final) swallows the "î" of the word it
 * leans on — "ne încetat" is sung and written "ne-ncetat", "nencetat" or,
 * with the vowel kept, "neîncetat" — so whichever one the operator types,
 * the other one is searched too:
 *
 *   "neincetat" → ["nencetat"]     (drop the elided î)
 *   "nencetat"  → ["neincetat"]    (put it back)
 *   "cainta"    → []               (the tail is too short to be a word)
 *   "inima"     → []               (no clitic in front)
 *
 * Input is expected to be diacritic-free and lowercase.
 */
export function elisionVariants(word: string): string[] {
  // The tail must be a consonant followed by at least three more letters —
  // short tails ("pentru", "cainta") are ordinary words, not contractions.
  const withI = word.match(/^(\p{L}?[aeiou])in(?=[^aeiou])(\p{L}{4,})$/u)
  if (withI) return [`${withI[1]}n${withI[2]}`]

  const withoutI = word.match(/^(\p{L}?[aeiou])n(?=[^aeiou])(\p{L}{4,})$/u)
  if (withoutI) return [`${withoutI[1]}in${withoutI[2]}`]

  return []
}
