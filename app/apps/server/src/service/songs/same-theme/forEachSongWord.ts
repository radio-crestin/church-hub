import type { VersionWords } from '../song-versions/scoreVersionPair'

/** Each distinct word of a song, title and lyrics together, by id. */
export function forEachSongWord(
  song: VersionWords,
  visit: (wordId: number) => void,
): void {
  forEachInEither(song.title.ids, song.lyrics.ids, visit)
}

/** Each value of two ascending lists once: their union, in order. */
export function forEachInEither(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  visit: (value: number) => void,
): void {
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] < b[j])) visit(a[i++])
    else if (i >= a.length || b[j] < a[i]) visit(b[j++])
    else {
      visit(a[i++])
      j++
    }
  }
}
