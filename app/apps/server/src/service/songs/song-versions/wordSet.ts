/**
 * A set of words as sorted word ids from the library's vocabulary, plus how
 * many of its words the library has never seen (they count toward its size
 * but can match nothing).
 */
export interface WordSet {
  ids: Int32Array
  unknown: number
}

export function wordSetSize(set: WordSet): number {
  return set.ids.length + set.unknown
}

/** The words as a `WordSet`; `assign` gives a word its id, or null if unknown. */
export function toWordSet(
  words: Iterable<string>,
  assign: (word: string) => number | null,
): WordSet {
  const ids: number[] = []
  let unknown = 0
  for (const word of new Set(words)) {
    const id = assign(word)
    if (id === null) unknown++
    else ids.push(id)
  }
  return { ids: Int32Array.from(ids).sort(), unknown }
}

export function intersectionSize(a: WordSet, b: WordSet): number {
  let i = 0
  let j = 0
  let shared = 0
  while (i < a.ids.length && j < b.ids.length) {
    if (a.ids[i] === b.ids[j]) {
      shared++
      i++
      j++
    } else if (a.ids[i] < b.ids[j]) i++
    else j++
  }
  return shared
}

/** Shared words over all words of the two sets (0 when either is empty). */
export function jaccard(a: WordSet, b: WordSet): number {
  const sizeA = wordSetSize(a)
  const sizeB = wordSetSize(b)
  if (sizeA === 0 || sizeB === 0) return 0
  const shared = intersectionSize(a, b)
  return shared / (sizeA + sizeB - shared)
}
