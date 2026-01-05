import { Music, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { SongCard } from './SongCard'
import {
  useCategories,
  useSearchKeyboardNavigation,
  useSearchSongs,
  useSongs,
} from '../hooks'
import type { Song, SongSearchResult } from '../types'

const MAX_DISPLAY_SONGS = 50
const SEARCH_DEBOUNCE_MS = 1500

interface SongListProps {
  onSongClick: (songId: number) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function SongList({
  onSongClick,
  searchQuery = '',
  onSearchChange,
}: SongListProps) {
  const { t } = useTranslation('songs')
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Local state for immediate input feedback
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // Debounced query for API calls - waits 1.5s after typing stops
  const {
    debouncedValue: debouncedQuery,
    triggerImmediately,
    isPending,
  } = useDebouncedValue(localQuery, SEARCH_DEBOUNCE_MS)

  const { data: songs, isLoading: songsLoading } = useSongs()
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching,
  } = useSearchSongs(debouncedQuery)
  const { data: categories } = useCategories()

  // Sync local state when URL search param changes (e.g., navigation)
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  const isSearching = localQuery.length > 0
  const hasSearchQuery = debouncedQuery.length > 0
  const isLoading = hasSearchQuery ? searchLoading || isFetching : songsLoading
  const showPendingIndicator = isPending && localQuery.length > 0

  const { displaySongs, totalCount } = useMemo(() => {
    let allSongs: Array<{
      id: number
      title: string
      categoryId: number | null
      categoryName: string | null
      highlightedTitle?: string
      matchedContent?: string
    }>

    if (hasSearchQuery && searchResults) {
      allSongs = searchResults.map((result: SongSearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        highlightedTitle: result.highlightedTitle,
        matchedContent: result.matchedContent,
      }))
    } else {
      allSongs =
        songs?.map((song: Song) => ({
          id: song.id,
          title: song.title,
          categoryId: song.categoryId,
          categoryName:
            categories?.find((c) => c.id === song.categoryId)?.name ?? null,
        })) ?? []
    }

    return {
      displaySongs: allSongs.slice(0, MAX_DISPLAY_SONGS),
      totalCount: allSongs.length,
    }
  }, [hasSearchQuery, searchResults, songs, categories])

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
    handleKeyDown: handleNavigationKeyDown,
    itemRefs,
  } = useSearchKeyboardNavigation({
    itemCount: displaySongs.length,
    onSelect: handleSelectSong,
  })

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

  const hasMore = totalCount > MAX_DISPLAY_SONGS

  return (
    <div className="space-y-4">
      <div className="relative">
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
              isSelected={selectedIndex === index}
            />
          ))}
          {hasMore && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">
              {t('search.moreResults', {
                count: totalCount - MAX_DISPLAY_SONGS,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
