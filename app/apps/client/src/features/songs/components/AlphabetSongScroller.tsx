import { useRef } from 'react'

import { AlphabetIndex } from './AlphabetIndex'
import { SongSectionHeader } from './SongSectionHeader'
import { useAlphabetScroll } from '../hooks/useAlphabetScroll'
import type { AlphabetSection } from '../utils/buildAlphabetSections'

interface AlphabetSongScrollerProps<T> {
  songs: T[]
  sections: AlphabetSection[]
  availableLetters: Set<string>
  /** Render a single song card. `index` is the flat index into `songs`. */
  renderSong: (song: T, index: number) => React.ReactNode
}

/**
 * Grouped, alphabetically-sectioned song list with the A–Z fast-scroll rail.
 *
 * Owns the scroll container (the offset parent the rail measures against) and
 * renders one sticky header per letter followed by that section's cards. The
 * flat song order is preserved so the parent's keyboard-navigation indices and
 * `itemRefs` keep lining up.
 */
export function AlphabetSongScroller<T extends { id: number; title: string }>({
  songs,
  sections,
  availableLetters,
  renderSong,
}: AlphabetSongScrollerProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const {
    letters,
    activeLetter,
    indicatorLetter,
    isDragging,
    railRef,
    registerSectionRef,
    jumpToLetter,
    railHandlers,
  } = useAlphabetScroll({
    scrollContainerRef,
    sections,
    availableLetters,
  })

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollContainerRef}
        className="relative h-full overflow-y-auto scrollbar-thin pr-7"
      >
        {sections.map((section) => {
          const end = section.firstIndex + section.count
          return (
            <div key={section.letter}>
              <SongSectionHeader
                ref={(el) => registerSectionRef(section.letter, el)}
                letter={section.letter}
              />
              <div className="grid gap-3 pb-2">
                {songs
                  .slice(section.firstIndex, end)
                  .map((song, offset) =>
                    renderSong(song, section.firstIndex + offset),
                  )}
              </div>
            </div>
          )
        })}
      </div>

      <AlphabetIndex
        letters={letters}
        availableLetters={availableLetters}
        activeLetter={activeLetter}
        indicatorLetter={indicatorLetter}
        isDragging={isDragging}
        railRef={railRef}
        onJumpToLetter={jumpToLetter}
        railHandlers={railHandlers}
      />
    </div>
  )
}
