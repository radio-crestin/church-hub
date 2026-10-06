import { joinedWordVariants } from './text/joinedWordVariants'

const PLAIN_WORD_RE = /^[\p{L}\p{N}]+$/u
const SIGNS_RE = /[^\p{L}\p{N}]+/u

/**
 * Every form one written word can be found by. A plain word is just
 * itself; a word with a hyphen or apostrophe is also its pieces and its
 * joined spellings, so "ne-ncetat" answers to "ne", "ncetat", "cetat",
 * "nencetat" and "neincetat", and "s-a" answers to "sa".
 */
export function wordUnitForms(unit: string): string[] {
  if (PLAIN_WORD_RE.test(unit)) return [unit]
  const pieces = unit.split(SIGNS_RE).filter((piece) => piece.length > 0)
  const forms = new Set<string>([...pieces, pieces.join('')])
  for (const variant of joinedWordVariants(unit)) forms.add(variant)
  for (const piece of pieces) {
    if (piece.length > 2 && /^n[^aeiou]/u.test(piece)) forms.add(piece.slice(1))
  }
  return Array.from(forms)
}
