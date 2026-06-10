import { ALPHABET_INDEX_LETTERS } from '../constants/alphabet'

/**
 * Resolves the letter to navigate to when the user targets `target`.
 *
 * If `target` has songs, it is returned unchanged. Otherwise the nearest
 * available letter is chosen, preferring the next letter forward (A→Z) before
 * falling back upward — matching the "snap to the next populated section"
 * behaviour of phone contact lists. Returns `null` when nothing is available.
 */
export function findNearestLetter(
  target: string,
  available: Set<string>,
): string | null {
  if (available.has(target)) return target

  const index = ALPHABET_INDEX_LETTERS.indexOf(target)
  if (index === -1) return null

  for (let distance = 1; distance < ALPHABET_INDEX_LETTERS.length; distance++) {
    const forward = ALPHABET_INDEX_LETTERS[index + distance]
    if (forward && available.has(forward)) return forward
    const backward = ALPHABET_INDEX_LETTERS[index - distance]
    if (backward && available.has(backward)) return backward
  }

  return null
}
