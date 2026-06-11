/**
 * The letter used to group titles that do not start with a Latin A–Z letter
 * (digits, symbols, non-Latin scripts). Rendered last in the rail, like the
 * "#" bucket in phone contact apps.
 */
export const NON_ALPHA_LETTER = '#'

/**
 * Ordered list of every letter shown in the alphabet fast-scroll rail:
 * A → Z followed by the non-alpha bucket. This order is the single source of
 * truth for both the rail and the grouped section order.
 */
export const ALPHABET_INDEX_LETTERS: string[] = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  NON_ALPHA_LETTER,
]

/**
 * Rank of a letter inside {@link ALPHABET_INDEX_LETTERS}. Used as the primary
 * sort key so sections always appear in rail order (A…Z, then "#").
 */
export function letterRank(letter: string): number {
  if (letter === NON_ALPHA_LETTER) return 26
  return letter.charCodeAt(0) - 65
}
