import { Loader2, Music, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { Combobox } from '~/ui/combobox'
import { SongCard } from './SongCard'
import {
  useCategories,
  useSearchKeyboardNavigation,
  useSearchSongs,
  useSongsInfinite,
} from '../hooks'
import type { SongSearchResult } from '../types'

const SEARCH_DEBOUNCE_MS = 1500

interface SongListProps {
  onSongClick: (songId: number) => void
  onSongMiddleClick?: (songId: number, songTitle: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  initialSelectedSongId?: number
  categoryId?: number
  onCategoryChange?: (categoryId: number | undefined) => void
  focusTrigger?: number
}

export function SongList({
  onSongClick,
  onSongMiddleClick,
  searchQuery = '',
  onSearchChange,
  initialSelectedSongId,
  categoryId,
  onCategoryChange,
  focusTrigger,
}: SongListProps) {
  const { t } = useTranslation('songs')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Local state for immediate input feedback
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // Debounced query for API calls - waits 1.5s after typing stops
  const {
    debouncedValue: debouncedQuery,
    triggerImmediately,
    isPending,
  } = useDebouncedValue(localQuery, SEARCH_DEBOUNCE_MS)

  // Infinite query for browse mode (non-search)
  const {
    data: songsData,
    isLoading: songsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSongsInfinite(categoryId)

  // Search query for search mode
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching,
  } = useSearchSongs(debouncedQuery, categoryId)

  const { data: categories } = useCategories()

  // Sync local state when URL search param changes (e.g., navigation)
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Focus search input when focusTrigger changes (from keyboard shortcut)
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0) {
      searchInputRef.current?.focus()
    }
  }, [focusTrigger])

  const isSearching = localQuery.length > 0
  const hasSearchQuery = debouncedQuery.length > 0
  const isLoading = hasSearchQuery ? searchLoading || isFetching : songsLoading
  const showPendingIndicator = isPending && localQuery.length > 0

  // Intersection Observer for infinite scroll
  useEffect(() => {
    // Only use infinite scroll in browse mode (non-search)
    if (hasSearchQuery || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        // When the load more element is 200px away from viewport, trigger fetch
        if (entries[0].isIntersecting) {
          fetchNextPage()
        }
      },
      {
        rootMargin: '200px', // Preload before reaching the end
      },
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasSearchQuery, hasNextPage, isFetchingNextPage, fetchNextPage])

  const { displaySongs, totalCount } = useMemo(() => {
    let allSongs: Array<{
      id: number
      title: string
      categoryId: number | null
      categoryName: string | null
      highlightedTitle?: string
      matchedContent?: string
      presentationCount?: number
    }>

    if (hasSearchQuery && searchResults) {
      // Search results are already filtered by category on the server
      allSongs = searchResults.map((result: SongSearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        highlightedTitle: result.highlightedTitle,
        matchedContent: result.matchedContent,
        presentationCount: result.presentationCount,
      }))
      return {
        displaySongs: allSongs,
        totalCount: allSongs.length,
      }
    }

    // Browse mode: use infinite query data
    const pages = songsData?.pages ?? []
    const songs = pages.flatMap((page) => page.songs)
    const total = pages[0]?.total ?? 0

    allSongs = songs.map((song) => ({
      id: song.id,
      title: song.title,
      categoryId: song.categoryId,
      categoryName:
        categories?.find((c) => c.id === song.categoryId)?.name ?? null,
      presentationCount: song.presentationCount,
    }))

    return {
      displaySongs: allSongs,
      totalCount: total,
    }
  }, [hasSearchQuery, searchResults, songsData, categories])

  // Keyboard navigation for search results
  const handleSelectSong = useCallback(
    (index: number) => {
      const song = displaySongs[index]
      if (song) {
        onSongClick(song.id)
      }
    },
    [displaySongs, onSongClick],
  )

  const {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown: handleNavigationKeyDown,
    itemRefs,
  } = useSearchKeyboardNavigation({
    itemCount: displaySongs.length,
    onSelect: handleSelectSong,
  })

  // Set initial selection based on initialSelectedSongId
  useEffect(() => {
    if (initialSelectedSongId && displaySongs.length > 0) {
      const index = displaySongs.findIndex(
        (song) => song.id === initialSelectedSongId,
      )
      if (index >= 0) {
        setSelectedIndex(index)
      }
    }
  }, [initialSelectedSongId, displaySongs, setSelectedIndex])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalQuery(value)
    onSearchChange?.(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // First handle navigation keys (Arrow Up/Down, Enter when item selected)
    handleNavigationKeyDown(e)

    // If navigation didn't handle Enter (no selection), trigger immediate search
    if (e.key === 'Enter' && selectedIndex < 0) {
      e.preventDefault()
      triggerImmediately()
    }
  }

  // Calculate fixed width for category dropdown based on longest option
  const categoryDropdownWidth = useMemo(() => {
    const allCategoriesLabel = t('search.allCategories')
    const labels = [
      allCategoriesLabel,
      ...(categories?.map((c) => c.name) ?? []),
    ]
    const longestLabel = labels.reduce(
      (longest, label) => (label.length > longest.length ? label : longest),
      '',
    )
    // Approximate width: ~8px per character + 48px for padding/icons
    return Math.max(140, longestLabel.length * 8 + 48)
  }, [categories, t])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={localQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="w-full pl-10 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
          />
          {showPendingIndicator && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
        <div style={{ width: categoryDropdownWidth }}>
          <Combobox
            options={[
              { value: 'all', label: t('search.allCategories') },
              ...(categories?.map((category) => ({
                value: category.id,
                label: category.name,
              })) ?? []),
            ]}
            value={categoryId ?? 'all'}
            onChange={(value) => {
              onCategoryChange?.(
                value !== null && value !== 'all' ? Number(value) : undefined,
              )
            }}
            placeholder={t('search.allCategories')}
            allowClear={false}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : displaySongs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <Music
            size={48}
            className="mx-auto text-gray-400 dark:text-gray-500 mb-3"
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            {isSearching
              ? t('search.noResults', { query: localQuery })
              : t('noSongs')}
          </p>
          {!isSearching && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t('noSongsDescription')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 min-w-0 overflow-hidden">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {isSearching
              ? t('search.resultsCount', { count: totalCount })
              : t('search.showingCount', {
                  showing: displaySongs.length,
                  total: totalCount,
                })}
          </p>
          {displaySongs.map((song, index) => (
            <SongCard
              key={song.id}
              ref={(el) => {
                if (el) {
                  itemRefs.current.set(index, el)
                } else {
                  itemRefs.current.delete(index)
                }
              }}
              song={song}
              onClick={() => onSongClick(song.id)}
              onMiddleClick={
                onSongMiddleClick
                  ? () => onSongMiddleClick(song.id, song.title)
                  : undefined
              }
              isSelected={selectedIndex === index}
            />
          ))}

          {/* Infinite scroll trigger element */}
          {!hasSearchQuery && hasNextPage && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isFetchingNextPage && (
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
