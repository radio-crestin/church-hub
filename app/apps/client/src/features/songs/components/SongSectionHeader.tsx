interface SongSectionHeaderProps {
  letter: string
}

/**
 * Alphabet section divider shown above each group of songs in the fast-scroll
 * list. Rendered inline as a virtualized row (one per letter), so it scrolls
 * with its section like the grouped sections of a contacts list.
 */
export function SongSectionHeader({ letter }: SongSectionHeaderProps) {
  return (
    <div
      data-testid={`song-section-${letter}`}
      className="flex items-center gap-2 px-0.5 pt-1 pb-2"
    >
      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-100 px-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
        {letter}
      </span>
      <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}
