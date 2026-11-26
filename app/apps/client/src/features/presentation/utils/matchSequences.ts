/**
 * Pairs the items two sequences have in common, in order: the longest run of
 * equal items both keep in the same order (an LCS). Returns, for each item of
 * `next`, the index of its pair in `prev`, or null when it has none.
 */
export function matchSequences(
  prev: readonly string[],
  next: readonly string[],
): (number | null)[] {
  // lengths[i][j]: the longest common run of prev[i..] and next[j..]
  const lengths = Array.from({ length: prev.length + 1 }, () =>
    new Array<number>(next.length + 1).fill(0),
  )
  for (let i = prev.length - 1; i >= 0; i--) {
    for (let j = next.length - 1; j >= 0; j--) {
      lengths[i][j] =
        prev[i] === next[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const matchOf = new Array<number | null>(next.length).fill(null)
  let i = 0
  let j = 0
  while (i < prev.length && j < next.length) {
    if (prev[i] === next[j]) {
      matchOf[j] = i
      i++
      j++
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return matchOf
}
