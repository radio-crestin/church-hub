/** Below this share of words in common, an edited block is a new slide. */
const MIN_SIMILARITY = 0.3

/**
 * Pairs edited blocks of the song's text with the slides they were, within one
 * stretch between unchanged slides. As many blocks as slides: they are the
 * same slides, rewritten in place. Otherwise each block, in order, takes the
 * unpaired slide after the last one paired that shares the most words with
 * it, if enough do.
 *
 * Returns, for each block, the index of its slide in `slides`, or null.
 */
export function matchEditedBlocks(
  blocks: string[],
  slides: string[],
): Array<number | null> {
  if (blocks.length === slides.length) return blocks.map((_, i) => i)

  const slideWords = slides.map(wordsOf)
  let next = 0
  return blocks.map((block) => {
    const words = wordsOf(block)
    let best: number | null = null
    let bestScore = MIN_SIMILARITY
    for (let i = next; i < slides.length; i += 1) {
      const score = similarity(words, slideWords[i])
      if (score >= bestScore) {
        best = i
        bestScore = score
      }
    }
    if (best !== null) next = best + 1
    return best
  })
}

function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let shared = 0
  for (const word of a) if (b.has(word)) shared += 1
  return shared / Math.max(a.size, b.size)
}
