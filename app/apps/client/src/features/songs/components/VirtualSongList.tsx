import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

const ESTIMATED_SONG_HEIGHT = 88
// How many rows from the end trigger a load — mirrors the old 200px rootMargin
// preload, but expressed in rows since the virtualizer reasons about indices.
const LOAD_MORE_THRESHOLD = 6

interface VirtualSongListProps<T> {
  songs: T[]
  /** Flat index of the keyboard-selected song (-1 when none). */
  selectedIndex: number
  /** Render a single song card. `index` is the flat index into `songs`. */
  renderSong: (song: T, index: number) => React.ReactNode
  /** Infinite-scroll: more pages exist (browse mode only). */
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  /** Called when the viewport nears the end and more pages can be loaded. */
  onLoadMore?: () => void
}

/**
 * Virtualized flat song list shared by every non-alphabet mode (browse, search,
 * AI search, bookmarks). Only the on-screen rows are mounted, so the list never
 * accumulates thousands of DOM nodes — whether grown by infinite scroll or by a
 * large result set. Infinite scroll is driven off the virtualizer's visible
 * range instead of a bottom sentinel.
 */
export function VirtualSongList<T extends { id: number }>({
  songs,
  selectedIndex,
  renderSong,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: VirtualSongListProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_SONG_HEIGHT,
    overscan: 10,
    getItemKey: (index) => songs[index]?.id ?? index,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]

  // Infinite scroll: load the next page once the rendered window reaches the
  // tail. fetchNextPage is a no-op while a fetch is in flight, so repeated
  // calls across scroll frames are safe.
  useEffect(() => {
    if (!onLoadMore || !hasNextPage || isFetchingNextPage) return
    if (lastItem && lastItem.index >= songs.length - 1 - LOAD_MORE_THRESHOLD) {
      onLoadMore()
    }
  }, [lastItem, hasNextPage, isFetchingNextPage, onLoadMore, songs.length])

  // Keep the keyboard-selected song in view even when its row is unmounted.
  // `auto` only scrolls when the row is off-screen, leaving the card's own
  // smooth scrollIntoView to handle already-visible selection changes.
  useEffect(() => {
    if (selectedIndex < 0) return
    virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
  }, [selectedIndex, virtualizer])

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mr-1.5 pr-1.5"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <div className="pb-3">
              {renderSong(songs[item.index], item.index)}
            </div>
          </div>
        ))}
      </div>

      {isFetchingNextPage && (
        <div className="py-4 flex justify-center">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      )}
    </div>
  )
}
