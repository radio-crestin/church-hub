import { forwardRef } from 'react'

interface SongSectionHeaderProps {
  letter: string
}

/**
 * Sticky alphabet section divider shown above each group of songs in the
 * fast-scroll list. Stays pinned at the top of the scroll container while its
 * section is in view, mirroring the grouped sections of a contacts list.
 */
export const SongSectionHeader = forwardRef<
  HTMLDivElement,
  SongSectionHeaderProps
>(function SongSectionHeader({ letter }, ref) {
  return (
    <div
      ref={ref}
      data-testid={`song-section-${letter}`}
      className="sticky top-0 z-10 -mx-0.5 mb-2 flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 px-0.5 py-1.5 backdrop-blur-sm"
    >
      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-100 px-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
        {letter}
      </span>
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  )
})
