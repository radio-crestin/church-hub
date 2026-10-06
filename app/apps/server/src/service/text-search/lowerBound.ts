/** Index of the first sorted entry that is not less than `value`. */
export function lowerBound(sorted: string[], value: string): number {
  let low = 0
  let high = sorted.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (sorted[mid] < value) low = mid + 1
    else high = mid
  }
  return low
}
