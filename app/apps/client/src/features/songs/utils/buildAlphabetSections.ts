import { getSongIndexLetter } from './getSongIndexLetter'
import { letterRank } from '../constants/alphabet'

// A single reusable collator — `localeCompare` builds a fresh collator on every
// call, which is catastrophic when sorting tens of thousands of titles. One
// shared Intl.Collator is orders of magnitude faster.
const TITLE_COLLATOR = new Intl.Collator('ro', {
  sensitivity: 'base',
  numeric: true,
})

export interface AlphabetSection {
  /** The bucket letter (A–Z or "#"). */
  letter: string
  /** Index into `sortedSongs` of the first song in this section. */
  firstIndex: number
  /** Number of songs in this section. */
  count: number
}

export interface AlphabetGrouping<T> {
  /** Songs re-sorted into rail order (A…Z, then "#"), diacritic-aware. */
  sortedSongs: T[]
  /** Contiguous sections aligned with `sortedSongs`. */
  sections: AlphabetSection[]
  /** Every letter that actually has at least one song. */
  availableLetters: Set<string>
}

/**
 * Groups songs into alphabet sections for the fast-scroll list.
 *
 * The server orders titles with a binary collation (case-sensitive, diacritics
 * after "z"), which would scatter Romanian titles across the rail. We therefore
 * re-sort client-side by (bucket letter, Romanian locale compare) so every
 * section is contiguous and the section order matches the rail order exactly —
 * a prerequisite for jump-to-letter and active-letter sync to line up.
 */
export function buildAlphabetSections<T extends { title: string }>(
  songs: T[],
): AlphabetGrouping<T> {
  const withLetter = songs.map((song) => ({
    song,
    letter: getSongIndexLetter(song.title),
  }))

  withLetter.sort((a, b) => {
    const rankDelta = letterRank(a.letter) - letterRank(b.letter)
    if (rankDelta !== 0) return rankDelta
    return TITLE_COLLATOR.compare(a.song.title, b.song.title)
  })

  const sortedSongs = withLetter.map((entry) => entry.song)
  const sections: AlphabetSection[] = []
  const availableLetters = new Set<string>()

  withLetter.forEach((entry, index) => {
    availableLetters.add(entry.letter)
    const current = sections[sections.length - 1]
    if (!current || current.letter !== entry.letter) {
      if (current) current.count = index - current.firstIndex
      sections.push({ letter: entry.letter, firstIndex: index, count: 0 })
    }
  })

  const last = sections[sections.length - 1]
  if (last) last.count = sortedSongs.length - last.firstIndex

  return { sortedSongs, sections, availableLetters }
}
