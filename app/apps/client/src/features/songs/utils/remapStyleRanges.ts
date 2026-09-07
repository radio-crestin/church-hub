import type { SlideStyleRange } from '../types'

/**
 * How big a rewritten stretch may get before the offsets are mapped
 * proportionally instead of aligned character by character. Proof-reading
 * changes a handful of characters, so the aligned path is the one that runs;
 * this only keeps a pathological rewrite from allocating a huge table.
 */
const MAX_ALIGNED = 800

/**
 * Where each character of `before` ends up in `after`.
 *
 * A slide's styling is stored as offsets into its text, so text that is
 * corrected — diacritics restored, a misspelling fixed — moves every run after
 * the change. The two versions are aligned so a run still covers the words it
 * was put on, rather than sliding along by however many characters the
 * correction added or removed.
 *
 * Returns an array of length `before.length + 1`, so an exclusive end offset
 * maps as readily as a start.
 */
export function buildOffsetMap(before: string, after: string): number[] {
  const map = new Array<number>(before.length + 1)

  let prefix = 0
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1
  }

  // Everything up to the first difference, and everything after the last one,
  // is untouched text — those offsets are known without any alignment.
  for (let i = 0; i <= prefix; i += 1) map[i] = i
  for (let i = before.length - suffix; i <= before.length; i += 1) {
    map[i] = after.length - (before.length - i)
  }

  const changedBefore = before.slice(prefix, before.length - suffix)
  const changedAfter = after.slice(prefix, after.length - suffix)
  if (changedBefore.length <= 1) return map

  const middle =
    changedBefore.length > MAX_ALIGNED || changedAfter.length > MAX_ALIGNED
      ? proportionalMap(changedBefore.length, changedAfter.length)
      : alignedMap(changedBefore, changedAfter)

  for (let i = 1; i < changedBefore.length; i += 1) {
    map[prefix + i] = prefix + middle[i]
  }
  return map
}

/** Aligns two short stretches on their longest common subsequence. */
function alignedMap(before: string, after: string): number[] {
  const rows = before.length + 1
  const columns = after.length + 1
  // `lcs[i * columns + j]` — the common subsequence left in before[i..]/after[j..].
  const lcs = new Int32Array(rows * columns)
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lcs[i * columns + j] =
        before[i] === after[j]
          ? lcs[(i + 1) * columns + j + 1] + 1
          : Math.max(lcs[(i + 1) * columns + j], lcs[i * columns + j + 1])
    }
  }

  const map = new Array<number>(before.length + 1)
  let i = 0
  let j = 0
  while (i < before.length) {
    map[i] = j
    if (before[i] === after[j]) {
      i += 1
      j += 1
    } else if (lcs[(i + 1) * columns + j] >= lcs[i * columns + j + 1]) {
      // The character was dropped: it collapses onto where it used to start.
      i += 1
    } else {
      // A character was inserted here, so only the new text advances.
      j += 1
    }
  }
  map[before.length] = after.length
  return map
}

/** Spreads the offsets evenly — the fallback for a rewrite too big to align. */
function proportionalMap(beforeLength: number, afterLength: number): number[] {
  const map = new Array<number>(beforeLength + 1)
  for (let i = 0; i <= beforeLength; i += 1) {
    map[i] = Math.round((i * afterLength) / beforeLength)
  }
  return map
}

/**
 * Moves style runs onto the corrected text, dropping any the correction left
 * with nothing to cover.
 */
export function remapStyleRanges(
  ranges: SlideStyleRange[],
  before: string,
  after: string,
): SlideStyleRange[] {
  const map = buildOffsetMap(before, after)
  const at = (offset: number) =>
    map[Math.max(0, Math.min(offset, before.length))]

  return ranges
    .map((range) => ({ ...range, start: at(range.start), end: at(range.end) }))
    .filter((range) => range.end > range.start)
}
