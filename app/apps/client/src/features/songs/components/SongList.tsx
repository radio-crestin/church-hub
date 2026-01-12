import { Loader2, Music, Search, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSidebarItemShortcuts } from '~/features/sidebar-config'
import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { MultiSelectCombobox } from '~/ui/combobox'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { SongCard } from './SongCard'
import { SongFiltersDropdown } from './SongFiltersDropdown'
import type { SongFiltersState } from './SongFiltersDropdown'
import {
  useAISearchSongs,
  useCategories,
  useSearchKeyboardNavigation,
  useSearchSongs,
  useSongsAISearchSettings,
  useSongsInfinite,
} from '../hooks'
import type { SongFilters } from '../service'
import type { AISearchResult, SongSearchResult } from '../types'

const SEARCH_DEBOUNCE_MS = 600

const CATEGORY_FILTER_STORAGE_KEY = 'songList.categoryFilter'
const PRESENTED_ONLY_STORAGE_KEY = 'songList.presentedOnly'
const IN_SCHEDULES_ONLY_STORAGE_KEY = 'songList.inSchedulesOnly'
const HAS_KEY_LINE_STORAGE_KEY = 'songList.hasKeyLine'

interface SongListProps {
  onSongClick: (songId: number) => void
  onSongMiddleClick?: (songId: number, songTitle: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  initialSelectedSongId?: number
  categoryIds?: number[]
  onCategoryChange?: (categoryIds: number[]) => void
  focusTrigger?: number
}

export function SongList({
  onSongClick,
  onSongMiddleClick,
  searchQuery = '',
  onSearchChange,
  initialSelectedSongId,
  categoryIds: propCategoryIds,
  onCategoryChange,
  focusTrigger,
}: SongListProps) {
  const { t } = useTranslation('songs')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Initialize category filter from local storage or props
  const [categoryIds, setCategoryIds] = useState<number[]>(() => {
    // If props provide category IDs, use them
    if (propCategoryIds && propCategoryIds.length > 0) {
      return propCategoryIds
    }
    // Otherwise try to load from local storage
    try {
      const stored = localStorage.getItem(CATEGORY_FILTER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          return parsed.filter((id): id is number => typeof id === 'number')
        }
      }
    } catch {
      // Ignore storage errors
    }
    return []
  })

  // Initialize presented only filter from local storage
  const [presentedOnly, setPresentedOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PRESENTED_ONLY_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Initialize in schedules only filter from local storage
  const [inSchedulesOnly, setInSchedulesOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(IN_SCHEDULES_ONLY_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Initialize has key line filter from local storage
  const [hasKeyLine, setHasKeyLine] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HAS_KEY_LINE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Sync with props when they change
  useEffect(() => {
    if (propCategoryIds !== undefined) {
      setCategoryIds(propCategoryIds)
    }
  }, [propCategoryIds])

  // Persist category selection to local storage
  const handleCategoryChange = useCallback(
    (newCategoryIds: Array<number | string>) => {
      const numericIds = newCategoryIds.filter(
        (id): id is number => typeof id === 'number',
      )
      setCategoryIds(numericIds)
      try {
        localStorage.setItem(
          CATEGORY_FILTER_STORAGE_KEY,
          JSON.stringify(numericIds),
        )
      } catch {
        // Ignore storage errors
      }
      onCategoryChange?.(numericIds)
    },
    [onCategoryChange],
  )

  // Handle filters change from dropdown
  const handleFiltersChange = useCallback((newFilters: SongFiltersState) => {
    setPresentedOnly(newFilters.presentedOnly)
    setInSchedulesOnly(newFilters.inSchedulesOnly)
    setHasKeyLine(newFilters.hasKeyLine)
    try {
      localStorage.setItem(
        PRESENTED_ONLY_STORAGE_KEY,
        String(newFilters.presentedOnly),
      )
      localStorage.setItem(
        IN_SCHEDULES_ONLY_STORAGE_KEY,
        String(newFilters.inSchedulesOnly),
      )
      localStorage.setItem(
        HAS_KEY_LINE_STORAGE_KEY,
        String(newFilters.hasKeyLine),
      )
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Build filters object for the API
  const songFilters: SongFilters = useMemo(
    () => ({
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      presentedOnly: presentedOnly || undefined,
      inSchedulesOnly: inSchedulesOnly || undefined,
      hasKeyLine: hasKeyLine || undefined,
    }),
    [categoryIds, presentedOnly, inSchedulesOnly, hasKeyLine],
  )

  // Build filters state for the dropdown
  const filtersState: SongFiltersState = useMemo(
    () => ({
      presentedOnly,
      inSchedulesOnly,
      hasKeyLine,
    }),
    [presentedOnly, inSchedulesOnly, hasKeyLine],
  )

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
  } = useSongsInfinite(songFilters)

  // Search query for search mode
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching,
  } = useSearchSongs(
    debouncedQuery,
    categoryIds.length > 0 ? categoryIds : undefined,
  )

  const { data: categories } = useCategories()

  // AI Search
  const { isEnabled: aiSearchAvailable } = useSongsAISearchSettings()
  const aiSearchMutation = useAISearchSongs()

  // Get search shortcut for display from sidebar config
  const sidebarShortcuts = useSidebarItemShortcuts()
  const searchSongShortcut = useMemo(() => {
    const songsShortcut = sidebarShortcuts.find((s) => s.route === '/songs')
    return songsShortcut?.shortcut
  }, [sidebarShortcuts])
  const [aiSearchResults, setAiSearchResults] = useState<AISearchResult[]>([])
  const [isAISearchActive, setIsAISearchActive] = useState(false)

  // Handle AI search button click
  const handleAISearch = useCallback(async () => {
    if (!localQuery.trim() || aiSearchMutation.isPending) return

    setIsAISearchActive(true)
    try {
      const response = await aiSearchMutation.mutateAsync({
        query: localQuery,
        categoryIds,
      })
      setAiSearchResults(response.results)
    } catch {
      setAiSearchResults([])
    }
  }, [localQuery, categoryIds, aiSearchMutation])

  // Clear AI results when query changes
  useEffect(() => {
    if (isAISearchActive) {
      setIsAISearchActive(false)
      setAiSearchResults([])
    }
  }, [localQuery])

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
      // Small delay to ensure window is fully focused and state updates have settled
      const timeoutId = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timeoutId)
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
      aiRelevanceScore?: number
    }>

    // AI search results take priority when active
    if (isAISearchActive && aiSearchResults.length > 0) {
      allSongs = aiSearchResults.map((result: AISearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        highlightedTitle: result.highlightedTitle,
        matchedContent: result.matchedContent,
        presentationCount: result.presentationCount,
        aiRelevanceScore: result.aiRelevanceScore,
      }))
      return {
        displaySongs: allSongs,
        totalCount: allSongs.length,
      }
    }

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
  }, [
    hasSearchQuery,
    searchResults,
    songsData,
    categories,
    isAISearchActive,
    aiSearchResults,
  ])

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
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={localQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              e.currentTarget.select()
              setSelectedIndex(-1)
            }}
            onFocus={(e) => {
              e.target.select()
              setSelectedIndex(-1)
            }}
            placeholder={t('search.placeholder')}
            className={`w-full pl-10 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${
              searchSongShortcut ? 'pr-20' : 'pr-8'
            }`}
          />
          {(showPendingIndicator || aiSearchMutation.isPending) && (
            <div
              className={`absolute top-1/2 transform -translate-y-1/2 flex items-center gap-1 ${
                searchSongShortcut ? 'right-14' : 'right-3'
              }`}
            >
              {aiSearchMutation.isPending ? (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span className="text-xs text-indigo-500">
                    {t('search.aiProcessing')}
                  </span>
                </>
              ) : (
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
              )}
            </div>
          )}
          {searchSongShortcut && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <KeyboardShortcutBadge shortcut={searchSongShortcut} />
            </div>
          )}
        </div>
        {aiSearchAvailable && (
          <button
            type="button"
            onClick={handleAISearch}
            disabled={!localQuery.trim() || aiSearchMutation.isPending}
            className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
              isAISearchActive
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={t('search.aiSearchTooltip')}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        <SongFiltersDropdown
          filters={filtersState}
          onChange={handleFiltersChange}
        />
        <div style={{ width: categoryDropdownWidth }}>
          <MultiSelectCombobox
            options={
              categories?.map((category) => ({
                value: category.id,
                label: category.name,
              })) ?? []
            }
            value={categoryIds}
            onChange={handleCategoryChange}
            placeholder={t('search.allCategories')}
            allSelectedLabel={t('search.allCategories')}
            emptyMeansAll
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 mt-4 grid gap-3 content-start">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : displaySongs.length === 0 ? (
        <div className="flex-1 mt-4 text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
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
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <p className="flex-shrink-0 text-sm text-gray-500 dark:text-gray-400 truncate mb-3">
            {isSearching
              ? t('search.resultsCount', { count: totalCount })
              : t('search.showingCount', {
                  showing: displaySongs.length,
                  total: totalCount,
                })}
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mr-1.5 pr-1.5">
            <div className="grid gap-3">
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
          </div>
        </div>
      )}
    </div>
  )
}
