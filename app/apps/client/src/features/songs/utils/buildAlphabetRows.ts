import type { AlphabetSection } from './buildAlphabetSections'

export type AlphabetRow<T> =
  | { type: 'header'; letter: string }
  | { type: 'song'; letter: string; song: T; flatIndex: number }

export interface AlphabetRowModel<T> {
  /** Flat list of header + song rows, in display order, for virtualization. */
  rows: AlphabetRow<T>[]
  /** Letter → index of its header row (jump-to-letter target). */
  headerIndexByLetter: Map<string, number>
  /** Flat song index → its row index (keyboard-selection scroll target). */
  songRowIndexByFlatIndex: Map<number, number>
}

/**
 * Flattens grouped songs into a single virtualizable row list where each letter
 * contributes one header row followed by its song rows. The lookup maps let the
 * scroller jump to a letter or to a keyboard-selected song in O(1) without
 * touching the DOM — essential for a 25k+ song library.
 */
export function buildAlphabetRows<T>(
  songs: T[],
  sections: AlphabetSection[],
): AlphabetRowModel<T> {
  const rows: AlphabetRow<T>[] = []
  const headerIndexByLetter = new Map<string, number>()
  const songRowIndexByFlatIndex = new Map<number, number>()

  for (const section of sections) {
    headerIndexByLetter.set(section.letter, rows.length)
    rows.push({ type: 'header', letter: section.letter })

    const end = section.firstIndex + section.count
    for (let flatIndex = section.firstIndex; flatIndex < end; flatIndex++) {
      songRowIndexByFlatIndex.set(flatIndex, rows.length)
      rows.push({
        type: 'song',
        letter: section.letter,
        song: songs[flatIndex],
        flatIndex,
      })
    }
  }

  return { rows, headerIndexByLetter, songRowIndexByFlatIndex }
}
