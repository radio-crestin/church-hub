/** Romanian definite-article and case endings, longest first. */
const ENDINGS = ['ului', 'ilor', 'elor', 'lui', 'lor', 'ul']
const STEM_LENGTH = 5

/**
 * The stem a word (ASCII-folded, as `tokenize` gives it) shares with its
 * inflected forms: its article ending dropped, then its first letters, so
 * "crucea"/"cruce", "harul"/"har" and "sangelui"/"sangele" meet.
 */
export function themeStem(word: string): string {
  const ending = ENDINGS.find(
    (end) => word.endsWith(end) && word.length - end.length >= 3,
  )
  const bare = ending ? word.slice(0, -ending.length) : word
  return bare.slice(0, STEM_LENGTH)
}
