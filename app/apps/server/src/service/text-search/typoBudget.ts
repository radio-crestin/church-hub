/**
 * How many typos a typed word may carry and still find its word: none for
 * short words (too many other words are one letter away), one from four
 * letters, two from eight.
 */
export function typoBudget(word: string): number {
  if (word.length >= 8) return 2
  if (word.length >= 4) return 1
  return 0
}
