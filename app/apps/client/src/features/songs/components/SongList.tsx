import { Clock, FolderOpen, Music, Search, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSidebarItemShortcuts } from '~/features/sidebar-config'
import { useSyncUpdatesMap } from '~/features/sync'
import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { MultiSelectCombobox } from '~/ui/combobox'
import { KeyboardShortcutBadge } from '~/ui/kbd'
import { ClearSearchButton } from '~/ui/search'
import { AlphabetSongScroller } from './AlphabetSongScroller'
import { SongCard } from './SongCard'
import type { SongFiltersState } from './SongFiltersDropdown'
import { SongFiltersDropdown } from './SongFiltersDropdown'
import { VirtualSongList } from './VirtualSongList'
import {
  useAISearchSongs,
  useAllSongsAlphabetical,
  useCategories,
  useSaveSearchHistory,
  useSearchKeyboardNavigation,
  useSearchSongs,
  useSongBookmarks,
  useSongsAISearchSettings,
  useSongsInfinite,
  useTags,
} from '../hooks'
import type { SongFilters, SongSortBy } from '../service'
import type { AISearchResult, SongSearchResult } from '../types'
import { buildAlphabetSections } from '../utils/buildAlphabetSections'

const SEARCH_DEBOUNCE_MS = 200

const CATEGORY_FILTER_STORAGE_KEY = 'songList.categoryFilter'
const TAG_FILTER_STORAGE_KEY = 'songList.tagFilter'
const PRESENTED_ONLY_STORAGE_KEY = 'songList.presentedOnly'
const IN_SCHEDULES_ONLY_STORAGE_KEY = 'songList.inSchedulesOnly'
const HAS_KEY_LINE_STORAGE_KEY = 'songList.hasKeyLine'
const BOOKMARKED_ONLY_STORAGE_KEY = 'songList.bookmarkedOnly'
const SORT_BY_STORAGE_KEY = 'songList.sortBy'

interface SongListProps {
  onSongClick: (songId: number) => void
  onSongMiddleClick?: (songId: number, songTitle: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  initialSelectedSongId?: number
  categoryIds?: number[]
  onCategoryChange?: (categoryIds: number[]) => void
  focusTrigger?: number
  initialAIResults?: AISearchResult[]
  aiSearchId?: number
  urlPath?: string
  onAISearchSaved?: (searchId: number) => void
  /**
   * Reports the keyboard-selected song so the page can act on it (e.g. add the
   * selected song to a program). Fires with null when nothing is selected.
   */
  onSelectedSongChange?: (song: { id: number; title: string } | null) => void
  /**
   * Lets song cards be dragged onto the Marcaje / Programe panels beside the
   * list. Off by default so pickers and embedded lists keep plain click
   * behaviour.
   */
  songsDraggable?: boolean
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
  initialAIResults,
  aiSearchId,
  urlPath,
  onAISearchSaved,
  onSelectedSongChange,
  songsDraggable = false,
}: SongListProps) {
  const { t } = useTranslation('songs')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const hasSelectedAllRef = useRef(false)

  // Initialize tag filter from local storage (orthogonal to category)
  const [tagIds, setTagIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(TAG_FILTER_STORAGE_KEY)
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

  const handleTagChange = useCallback((newTagIds: Array<number | string>) => {
    const numericIds = newTagIds.filter(
      (id): id is number => typeof id === 'number',
    )
    setTagIds(numericIds)
    try {
      localStorage.setItem(TAG_FILTER_STORAGE_KEY, JSON.stringify(numericIds))
    } catch {
      // Ignore storage errors
    }
  }, [])

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

  // Initialize bookmarked only filter from local storage
  const [bookmarkedOnly, setBookmarkedOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BOOKMARKED_ONLY_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Initialize sort from local storage
  const [sortBy, setSortBy] = useState<SongSortBy | undefined>(() => {
    try {
      const stored = localStorage.getItem(SORT_BY_STORAGE_KEY)
      if (
        stored &&
        ['lastPlayed', 'mostPlayed', 'title', 'newest', 'oldest'].includes(
          stored,
        )
      ) {
        return stored as SongSortBy
      }
    } catch {
      // Ignore storage errors
    }
    return undefined
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
    setBookmarkedOnly(newFilters.bookmarkedOnly)
    setSortBy(newFilters.sortBy)
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
      localStorage.setItem(
        BOOKMARKED_ONLY_STORAGE_KEY,
        String(newFilters.bookmarkedOnly),
      )
      localStorage.setItem(SORT_BY_STORAGE_KEY, newFilters.sortBy ?? '')
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Build filters object for the API
  const songFilters: SongFilters = useMemo(
    () => ({
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      presentedOnly: presentedOnly || undefined,
      inSchedulesOnly: inSchedulesOnly || undefined,
      hasKeyLine: hasKeyLine || undefined,
      sortBy,
    }),
    [categoryIds, tagIds, presentedOnly, inSchedulesOnly, hasKeyLine, sortBy],
  )

  // Build filters state for the dropdown
  const filtersState: SongFiltersState = useMemo(
    () => ({
      presentedOnly,
      inSchedulesOnly,
      hasKeyLine,
      bookmarkedOnly,
      sortBy,
    }),
    [presentedOnly, inSchedulesOnly, hasKeyLine, bookmarkedOnly, sortBy],
  )

  // Check if any filters are active
  const hasActiveFilters = useMemo(
    () =>
      categoryIds.length > 0 ||
      tagIds.length > 0 ||
      presentedOnly ||
      inSchedulesOnly ||
      hasKeyLine ||
      bookmarkedOnly,
    [
      categoryIds,
      tagIds,
      presentedOnly,
      inSchedulesOnly,
      hasKeyLine,
      bookmarkedOnly,
    ],
  )

  // Clear all filters
  const handleClearAllFilters = useCallback(() => {
    setCategoryIds([])
    setTagIds([])
    setPresentedOnly(false)
    setInSchedulesOnly(false)
    setHasKeyLine(false)
    setBookmarkedOnly(false)
    setSortBy(undefined)
    try {
      localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify([]))
      localStorage.setItem(TAG_FILTER_STORAGE_KEY, JSON.stringify([]))
      localStorage.setItem(PRESENTED_ONLY_STORAGE_KEY, 'false')
      localStorage.setItem(IN_SCHEDULES_ONLY_STORAGE_KEY, 'false')
      localStorage.setItem(HAS_KEY_LINE_STORAGE_KEY, 'false')
      localStorage.setItem(BOOKMARKED_ONLY_STORAGE_KEY, 'false')
      localStorage.setItem(SORT_BY_STORAGE_KEY, '')
    } catch {
      // Ignore storage errors
    }
    onCategoryChange?.([])
  }, [onCategoryChange])

  // Local state for immediate input feedback
  const [localQuery, setLocalQuery] = useState(searchQuery)

  // Debounced query for API calls - waits 1.5s after typing stops
  const {
    debouncedValue: debouncedQuery,
    triggerImmediately,
    isPending,
  } = useDebouncedValue(localQuery, SEARCH_DEBOUNCE_MS)

  // Alphabet fast-scroll is the natural companion of the A–Z sort: it only
  // engages while browsing the full list in title order (no search / bookmarks
  // filter). When it does, the infinite query is disabled and the whole list is
  // loaded at once via useAllSongsAlphabetical so any letter is reachable.
  const alphabetEligible =
    sortBy === 'title' && debouncedQuery.length === 0 && !bookmarkedOnly

  // Infinite query for browse mode (non-search)
  const {
    data: songsData,
    isLoading: songsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSongsInfinite(songFilters, !alphabetEligible)

  // Search query for search mode
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching,
  } = useSearchSongs(
    debouncedQuery,
    categoryIds.length > 0 ? categoryIds : undefined,
    {
      presentedOnly: presentedOnly || undefined,
      inSchedulesOnly: inSchedulesOnly || undefined,
      hasKeyLine: hasKeyLine || undefined,
    },
  )

  const { data: categories } = useCategories()
  // Hidden categories are dropped from the filter UI (their songs are already
  // excluded from the list server-side). `categories` (all) is still used for
  // resolving a song's category name.
  const visibleCategories = useMemo(
    () => categories?.filter((c) => c.isHidden !== 1),
    [categories],
  )
  const { data: songTags } = useTags()
  const { data: bookmarks = [] } = useSongBookmarks()

  // AI Search
  const { isEnabled: aiSearchAvailable } = useSongsAISearchSettings()
  const aiSearchMutation = useAISearchSongs()

  // Get search shortcut for display from sidebar config
  const sidebarShortcuts = useSidebarItemShortcuts()
  const searchSongShortcut = useMemo(() => {
    const songsShortcut = sidebarShortcuts.find((s) => s.route === '/songs')
    return songsShortcut?.shortcut
  }, [sidebarShortcuts])
  const [aiSearchResults, setAiSearchResults] = useState<AISearchResult[]>(
    () => initialAIResults ?? [],
  )
  // Initialize isAISearchActive to true when aiSearchId is present (restoring AI search)
  // This prevents regular search from overwriting AI search data while loading
  const [isAISearchActive, setIsAISearchActive] = useState(
    () => !!aiSearchId || (!!initialAIResults && initialAIResults.length > 0),
  )

  // Save search history mutation
  const saveSearchHistory = useSaveSearchHistory()

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

      // Save AI search to history and notify parent
      if (urlPath) {
        const savedHistory = await saveSearchHistory.mutateAsync({
          query: localQuery,
          urlPath,
          searchType: 'ai',
          categoryIds: categoryIds.length > 0 ? categoryIds : null,
          aiResults: response.results,
          resultCount: response.results.length,
        })
        if (savedHistory?.id && onAISearchSaved) {
          onAISearchSaved(savedHistory.id)
        }
      }
    } catch {
      setAiSearchResults([])
    }
  }, [
    localQuery,
    categoryIds,
    aiSearchMutation,
    urlPath,
    saveSearchHistory,
    onAISearchSaved,
  ])

  // Update AI results when initialAIResults is loaded (async fetch)
  useEffect(() => {
    if (initialAIResults && initialAIResults.length > 0) {
      setAiSearchResults(initialAIResults)
      setIsAISearchActive(true)
    }
  }, [initialAIResults])

  // Track previous query to detect actual user-initiated changes (not initial load)
  const prevLocalQueryRef = useRef(localQuery)

  // Clear AI results when query changes (user typing), but not on initial render
  useEffect(() => {
    // Skip if this is the initial render or query hasn't actually changed
    if (prevLocalQueryRef.current === localQuery) {
      return
    }
    prevLocalQueryRef.current = localQuery

    if (isAISearchActive) {
      setIsAISearchActive(false)
      setAiSearchResults([])
    }
  }, [localQuery, isAISearchActive])

  // Save regular searches to history when search completes
  useEffect(() => {
    if (
      urlPath &&
      debouncedQuery.trim() &&
      searchResults &&
      searchResults.length > 0 &&
      !isAISearchActive
    ) {
      saveSearchHistory.mutate({
        query: debouncedQuery,
        urlPath,
        searchType: 'regular',
        categoryIds: categoryIds.length > 0 ? categoryIds : null,
        resultCount: searchResults.length,
      })
    }
  }, [debouncedQuery, searchResults, urlPath, categoryIds, isAISearchActive])

  // Sync local state when URL search param changes (e.g., navigation).
  //
  // Searching deliberately leaves the filters alone. It used to clear them —
  // and not just in state: it overwrote every stored filter, so typing one
  // letter threw away the sort and filters the operator had set, for good.
  // Clearing filters stays a thing the operator asks for, with the button.
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

  // Alphabet mode also requires that no AI search is showing its own results.
  const alphabetMode = alphabetEligible && !isAISearchActive
  const { data: alphabetData, isLoading: alphabetLoading } =
    useAllSongsAlphabetical(songFilters, alphabetMode)

  const isLoading = alphabetMode
    ? alphabetLoading
    : hasSearchQuery
      ? searchLoading || isFetching
      : songsLoading
  const showPendingIndicator = isPending && localQuery.length > 0

  // Infinite scroll is virtualizer-driven inside VirtualSongList; it only
  // applies in plain browse mode (no search / AI / bookmarks filter).
  const browseInfiniteScroll =
    !hasSearchQuery && !isAISearchActive && !bookmarkedOnly

  // Set of bookmarked song IDs for efficient filtering
  const bookmarkedSongIds = useMemo(
    () => new Set(bookmarks.map((b) => b.songId)),
    [bookmarks],
  )

  // Group the fully-loaded list into diacritic-aware A–Z sections for the rail.
  // Server order is binary-collated, so we re-sort client-side here (see
  // buildAlphabetSections). Null when not in alphabet mode.
  const alphabetGrouping = useMemo(() => {
    if (!alphabetMode) return null
    // Resolve category names via a Map — a per-song `.find()` over the category
    // list is O(songs × categories), which is painful across 25k+ songs.
    const categoryNameById = new Map(
      (categories ?? []).map((c) => [c.id, c.name]),
    )
    const mapped = (alphabetData?.songs ?? []).map((song) => ({
      id: song.id,
      title: song.title,
      categoryId: song.categoryId,
      categoryName:
        song.categoryId != null
          ? (categoryNameById.get(song.categoryId) ?? null)
          : null,
      keyLine: song.keyLine,
      presentationCount: song.presentationCount,
      tagNames: song.tagNames,
    }))
    return buildAlphabetSections(mapped)
  }, [alphabetMode, alphabetData, categories])

  const { displaySongs, totalCount } = useMemo(() => {
    // Alphabet mode renders the fully-loaded, re-sorted list so the flat index
    // stays aligned with the rail sections and keyboard navigation.
    if (alphabetMode) {
      const sorted = alphabetGrouping?.sortedSongs ?? []
      return { displaySongs: sorted, totalCount: sorted.length }
    }

    let allSongs: Array<{
      id: number
      title: string
      categoryId: number | null
      categoryName: string | null
      keyLine?: string | null
      highlightedTitle?: string
      matchedContent?: string
      presentationCount?: number
      aiRelevanceScore?: number
      score?: number
      tagNames?: string[]
    }>

    // When bookmarkedOnly is active and not searching, show bookmarks directly
    if (bookmarkedOnly && !hasSearchQuery && !isAISearchActive) {
      allSongs = bookmarks.map((b) => ({
        id: b.songId,
        title: b.songTitle,
        categoryId: null,
        categoryName: b.songCategoryName,
        keyLine: b.songKeyLine,
      }))
      return {
        displaySongs: allSongs,
        totalCount: allSongs.length,
      }
    }

    // AI search results take priority when active
    if (isAISearchActive && aiSearchResults.length > 0) {
      allSongs = aiSearchResults.map((result: AISearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        keyLine: result.keyLine,
        highlightedTitle: result.highlightedTitle,
        matchedContent: result.matchedContent,
        presentationCount: result.presentationCount,
        aiRelevanceScore: result.aiRelevanceScore,
      }))
      if (bookmarkedOnly) {
        allSongs = allSongs.filter((s) => bookmarkedSongIds.has(s.id))
      }
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
        keyLine: result.keyLine,
        highlightedTitle: result.highlightedTitle,
        matchedContent: result.matchedContent,
        presentationCount: result.presentationCount,
        score: result.score,
      }))
      if (bookmarkedOnly) {
        allSongs = allSongs.filter((s) => bookmarkedSongIds.has(s.id))
      }
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
      keyLine: song.keyLine,
      presentationCount: song.presentationCount,
      tagNames: song.tagNames,
    }))

    if (bookmarkedOnly) {
      allSongs = allSongs.filter((s) => bookmarkedSongIds.has(s.id))
      return {
        displaySongs: allSongs,
        totalCount: allSongs.length,
      }
    }

    return {
      displaySongs: allSongs,
      totalCount: total,
    }
  }, [
    alphabetMode,
    alphabetGrouping,
    hasSearchQuery,
    searchResults,
    songsData,
    categories,
    isAISearchActive,
    aiSearchResults,
    bookmarkedOnly,
    bookmarks,
    bookmarkedSongIds,
  ])

  // Detect duplicate titles to show category disambiguation
  const duplicateTitles = useMemo(() => {
    const titleCounts = new Map<string, number>()
    for (const song of displaySongs) {
      const lower = song.title.toLowerCase()
      titleCounts.set(lower, (titleCounts.get(lower) ?? 0) + 1)
    }
    const duplicates = new Set<string>()
    for (const [title, count] of titleCounts) {
      if (count > 1) duplicates.add(title)
    }
    return duplicates
  }, [displaySongs])

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

  // Unseen "changed on another device" sync entries, keyed by song id.
  const syncUpdatesMap = useSyncUpdatesMap('song')

  // Single source of truth for a song card, shared by the flat browse grid and
  // the alphabet scroller so keyboard selection, middle-click and itemRefs
  // behave identically in both. `index` is the flat index into displaySongs.
  const renderSong = useCallback(
    (song: (typeof displaySongs)[number], index: number) => (
      <SongCard
        key={song.id}
        ref={(el) => {
          if (el) itemRefs.current.set(index, el)
          else itemRefs.current.delete(index)
        }}
        song={song}
        onClick={() => onSongClick(song.id)}
        onMiddleClick={
          onSongMiddleClick
            ? () => onSongMiddleClick(song.id, song.title)
            : undefined
        }
        isSelected={selectedIndex === index}
        showCategoryInTitle={duplicateTitles.has(song.title.toLowerCase())}
        syncChangeKind={syncUpdatesMap.get(song.id)}
        isDraggable={songsDraggable}
        dragHandleTitle={t('dragToPanel')}
      />
    ),
    [
      itemRefs,
      onSongClick,
      onSongMiddleClick,
      selectedIndex,
      duplicateTitles,
      syncUpdatesMap,
      songsDraggable,
      t,
    ],
  )

  // Set initial selection based on initialSelectedSongId and scroll into view.
  //
  // The ref guard fires the scroll *once per requested id*, not on every
  // `displaySongs` update. Without it, infinite-scroll's `fetchNextPage()`
  // appends a new page → `displaySongs` reference changes → this effect
  // re-runs → `scrollIntoView` snaps the viewport back up to the originally
  // selected song, briefly blanking the area below and erasing the
  // operator's scroll position. Reported as: "scroll-ul merge din nou sus
  // și se pune în alb când ajung la final și se încarcă pagina următoare."
  const lastScrolledToSongIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (!initialSelectedSongId) {
      // Cleared selection — forget so a future re-selection of the same
      // id still scrolls back into view.
      lastScrolledToSongIdRef.current = null
      return
    }
    if (lastScrolledToSongIdRef.current === initialSelectedSongId) return
    if (displaySongs.length === 0) return

    const index = displaySongs.findIndex(
      (song) => song.id === initialSelectedSongId,
    )
    // Not loaded yet — let the effect retry when the next page arrives.
    if (index < 0) return

    setSelectedIndex(index)
    const el = itemRefs.current.get(index)
    el?.scrollIntoView({ block: 'center' })
    lastScrolledToSongIdRef.current = initialSelectedSongId
  }, [initialSelectedSongId, displaySongs, setSelectedIndex, itemRefs])

  // Mirror the keyboard selection out to the page. Kept as its own effect so
  // the selection stays owned by useSearchKeyboardNavigation.
  useEffect(() => {
    if (!onSelectedSongChange) return
    const song = selectedIndex >= 0 ? displaySongs[selectedIndex] : undefined
    onSelectedSongChange(song ? { id: song.id, title: song.title } : null)
  }, [selectedIndex, displaySongs, onSelectedSongChange])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setLocalQuery(value)
    onSearchChange?.(value)
  }

  const handleClearSearch = () => {
    setLocalQuery('')
    onSearchChange?.('')
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
      ...(visibleCategories?.map((c) => c.name) ?? []),
    ]
    const longestLabel = labels.reduce(
      (longest, label) => (label.length > longest.length ? label : longest),
      '',
    )
    // Approximate width: ~8px per character + 48px for padding/icons
    return Math.max(140, longestLabel.length * 8 + 48)
  }, [visibleCategories, t])

  const [isCategoryOpen, setIsCategoryOpen] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex-shrink-0 pb-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={localQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onMouseDown={(e) => {
                if (localQuery) {
                  if (hasSelectedAllRef.current) return
                  e.preventDefault()
                  e.currentTarget.focus()
                  e.currentTarget.select()
                  hasSelectedAllRef.current = true
                }
                setSelectedIndex(-1)
              }}
              onFocus={(e) => {
                e.target.select()
                hasSelectedAllRef.current = true
                setSelectedIndex(-1)
              }}
              onBlur={() => {
                hasSelectedAllRef.current = false
              }}
              placeholder={t('search.placeholder')}
              className={`
              w-full 
              pl-9 
              py-2 
              text-sm 
              bg-gray-50 dark:bg-gray-700 
              border border-gray-200 dark:border-gray-600 
              rounded-lg 
              focus:ring-2 f
              ocus:ring-indigo-500 
              focus:border-indigo-500 
              text-gray-900 
              dark:text-white 
              placeholder-gray-400
              ${searchSongShortcut && !localQuery ? 'pr-20' : 'pr-9'}
              `}
            />
            {(showPendingIndicator || aiSearchMutation.isPending) && (
              <div className="absolute top-1/2 transform -translate-y-1/2 flex items-center gap-1 right-9">
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
            {localQuery ? (
              <ClearSearchButton
                inputRef={searchInputRef}
                onClear={handleClearSearch}
              />
            ) : searchSongShortcut ? (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <KeyboardShortcutBadge shortcut={searchSongShortcut} />
              </div>
            ) : null}
          </div>
          {aiSearchAvailable && (
            <button
              type="button"
              onClick={handleAISearch}
              disabled={!localQuery.trim() || aiSearchMutation.isPending}
              className={`px-2 py-1.5 md:px-3 md:py-2 rounded-lg border transition-colors flex items-center gap-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
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
          {/* Category dropdown: icon on mobile, full dropdown on desktop */}
          {/* The wrapper itself is md:hidden — leaving an empty div in the
            flex row at desktop sizes adds a phantom gap-2 between the
            filter button and the desktop combobox. */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className={`px-2 py-1.5 rounded-lg border transition-colors flex items-center ${
                categoryIds.length > 0
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
              title={t('search.allCategories')}
            >
              <FolderOpen className="w-4 h-4" />
              {categoryIds.length > 0 && (
                <span className="ml-1 text-xs font-medium">
                  {categoryIds.length}
                </span>
              )}
            </button>
            {isCategoryOpen && (
              <>
                <div
                  className="md:hidden fixed inset-0 z-10"
                  onClick={() => setIsCategoryOpen(false)}
                />
                <div
                  className="md:hidden absolute right-0 top-full mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden"
                  style={{ minWidth: 200, maxWidth: 'calc(100vw - 24px)' }}
                >
                  <div className="p-1 max-h-64 overflow-y-auto">
                    {visibleCategories?.map((category) => {
                      const isSelected = categoryIds.includes(category.id)
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            const next = isSelected
                              ? categoryIds.filter((id) => id !== category.id)
                              : [...categoryIds, category.id]
                            handleCategoryChange(next)
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}
                          >
                            {isSelected && <X className="w-3 h-3 text-white" />}
                          </div>
                          {category.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          <div
            className="hidden md:block"
            style={{ width: categoryDropdownWidth }}
          >
            <MultiSelectCombobox
              options={
                visibleCategories?.map((category) => ({
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
          {(songTags?.length ?? 0) > 0 && (
            <div className="hidden md:block min-w-[140px]">
              <MultiSelectCombobox
                options={
                  songTags?.map((tag) => ({
                    value: tag.id,
                    label: tag.name,
                  })) ?? []
                }
                value={tagIds}
                onChange={handleTagChange}
                placeholder={t('tags.filterAll')}
                allOptionLabel={t('tags.filterAll')}
              />
            </div>
          )}
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
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="mt-4 py-2 px-4 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              {t('search.clearFiltersForMore')}
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <p className="flex-shrink-0 text-sm text-gray-500 dark:text-gray-400 truncate mb-3 flex items-center gap-1.5">
            <span>
              {isSearching
                ? t('search.resultsCount', { count: totalCount })
                : t('search.showingCount', {
                    showing: displaySongs.length,
                    total: totalCount,
                  })}
            </span>
            {!isSearching && (!sortBy || sortBy === 'lastPlayed') && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <Clock className="w-3 h-3" />
                {t('search.sortLastPlayed')}
              </span>
            )}
          </p>
          {alphabetMode && alphabetGrouping ? (
            <AlphabetSongScroller
              songs={displaySongs}
              sections={alphabetGrouping.sections}
              availableLetters={alphabetGrouping.availableLetters}
              selectedIndex={selectedIndex}
              renderSong={renderSong}
            />
          ) : (
            <VirtualSongList
              songs={displaySongs}
              selectedIndex={selectedIndex}
              renderSong={renderSong}
              hasNextPage={browseInfiniteScroll && hasNextPage}
              isFetchingNextPage={browseInfiniteScroll && isFetchingNextPage}
              onLoadMore={fetchNextPage}
            />
          )}
        </div>
      )}
    </div>
  )
}
