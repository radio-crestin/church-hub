import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { AlphabetIndex } from './AlphabetIndex'
import { SongSectionHeader } from './SongSectionHeader'
import { ALPHABET_INDEX_LETTERS } from '../constants/alphabet'
import { useAlphabetScroll } from '../hooks/useAlphabetScroll'
import { buildAlphabetRows } from '../utils/buildAlphabetRows'
import type { AlphabetSection } from '../utils/buildAlphabetSections'
import { findNearestLetter } from '../utils/findNearestLetter'

const ESTIMATED_HEADER_HEIGHT = 36
const ESTIMATED_SONG_HEIGHT = 88

interface AlphabetSongScrollerProps<T> {
  songs: T[]
  sections: AlphabetSection[]
  availableLetters: Set<string>
  /** Flat index of the keyboard-selected song (-1 when none). */
  selectedIndex: number
  /** Render a single song card. `index` is the flat index into `songs`. */
  renderSong: (song: T, index: number) => React.ReactNode
}

/**
 * Virtualized, alphabetically-sectioned song list with the A–Z fast-scroll
 * rail. Only the handful of on-screen rows are mounted, so the list stays fluid
 * for very large libraries (tens of thousands of songs). Header and song rows
 * share one virtualizer; the rail jumps by row index and the active letter is
 * derived from the first visible row — no per-frame re-render of the full list.
 */
export function AlphabetSongScroller<T extends { id: number; title: string }>({
  songs,
  sections,
  availableLetters,
  selectedIndex,
  renderSong,
}: AlphabetSongScrollerProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { rows, headerIndexByLetter, songRowIndexByFlatIndex } = useMemo(
    () => buildAlphabetRows(songs, sections),
    [songs, sections],
  )

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      rows[index].type === 'header'
        ? ESTIMATED_HEADER_HEIGHT
        : ESTIMATED_SONG_HEIGHT,
    overscan: 10,
    getItemKey: (index) => {
      const row = rows[index]
      return row.type === 'header' ? `h:${row.letter}` : `s:${row.song.id}`
    },
  })

  const scrollToLetter = useCallback(
    (letter: string) => {
      const resolved = findNearestLetter(letter, availableLetters)
      if (!resolved) return
      const rowIndex = headerIndexByLetter.get(resolved)
      if (rowIndex == null) return
      virtualizer.scrollToIndex(rowIndex, { align: 'start' })
    },
    [availableLetters, headerIndexByLetter, virtualizer],
  )

  const { railRef, indicatorLetter, isDragging, railHandlers } =
    useAlphabetScroll({ onSelectLetter: scrollToLetter })

  // Bring the keyboard-selected song into view even when its row is unmounted
  // (virtualized lists drop offscreen rows, so the card's scrollIntoView alone
  // cannot reach it).
  useEffect(() => {
    if (selectedIndex < 0) return
    const rowIndex = songRowIndexByFlatIndex.get(selectedIndex)
    if (rowIndex != null) {
      virtualizer.scrollToIndex(rowIndex, { align: 'auto' })
    }
  }, [selectedIndex, songRowIndexByFlatIndex, virtualizer])

  const virtualItems = virtualizer.getVirtualItems()
  const scrollOffset = virtualizer.scrollOffset ?? 0
  const activeRow =
    virtualItems.find((item) => item.end > scrollOffset + 1) ?? virtualItems[0]
  const activeLetter = activeRow ? rows[activeRow.index].letter : null

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scrollbar-thin pr-7"
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualItems.map((item) => {
            const row = rows[item.index]
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                {row.type === 'header' ? (
                  <SongSectionHeader letter={row.letter} />
                ) : (
                  <div className="pb-3">
                    {renderSong(row.song, row.flatIndex)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <AlphabetIndex
        letters={ALPHABET_INDEX_LETTERS}
        availableLetters={availableLetters}
        activeLetter={activeLetter}
        indicatorLetter={indicatorLetter}
        isDragging={isDragging}
        railRef={railRef}
        onJumpToLetter={scrollToLetter}
        railHandlers={railHandlers}
      />
    </div>
  )
}
