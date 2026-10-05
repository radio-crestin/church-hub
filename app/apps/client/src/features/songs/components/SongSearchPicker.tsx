import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, Music, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClearSearchButton } from '~/ui/search'
import { SongCategoryFilter } from './SongCategoryFilter'
import { SongTagFilter } from './SongTagFilter'
import { useCategories } from '../hooks/useCategories'
import { useSearchSongs } from '../hooks/useSearchSongs'
import { useSongsInfinite } from '../hooks/useSongsInfinite'

/** Rows revealed per "load more" step, matching the server page size. */
const PAGE_SIZE = 50
/** Fixed row height fed to the virtualizer (rows are single-line + subtitle). */
const ROW_HEIGHT = 52

interface PickerRow {
  id: number
  title: string
  categoryName: string | null
  keyLine: string | null
}

interface SongSearchPickerProps {
  onSongSelect: (songId: number) => void | Promise<void>
  /** Focuses the search box on mount — the picker is always search-first. */
  autoFocus?: boolean
  className?: string
}

/**
 * Search-first song picker: a search box over a virtualized, incrementally
 * loaded list.
 *
 * Deliberately does NOT reuse `SongList`. That component doubles as the Songs
 * page browser and, when its persisted sort is A–Z, switches to a mode that
 * pulls the entire library in one request and runs several full passes plus a
 * locale-aware sort synchronously during render — which froze the app when the
 * picker was opened from a program. Here, browsing pages 50 rows at a time from
 * the server and searching reveals 50 results at a time, so neither path ever
 * touches the whole library at once.
 */
export function SongSearchPicker({
  onSongSelect,
  autoFocus = true,
  className = '',
}: SongSearchPickerProps) {
  const { t } = useTranslation('songs')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [tagIds, setTagIds] = useState<number[]>([])
  // Filter dropdowns portal here: the picker lives in a modal <dialog>, whose
  // top layer would hide anything portaled to <body>.
  const [dialogEl, setDialogEl] = useState<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    setDialogEl(node?.closest('dialog') ?? null)
  }, [])

  useEffect(() => {
    if (autoFocus) searchInputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(handle)
  }, [query])

  // A new query or filter always restarts the reveal window and scroll position.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [debouncedQuery, categoryIds, tagIds])

  const isSearching = debouncedQuery.length > 0
  const hasFilters = categoryIds.length > 0 || tagIds.length > 0
  const activeCategoryIds = categoryIds.length > 0 ? categoryIds : undefined
  const activeTagIds = tagIds.length > 0 ? tagIds : undefined

  const {
    data: browseData,
    isLoading: browseLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useSongsInfinite(
    { sortBy: 'title', categoryIds: activeCategoryIds, tagIds: activeTagIds },
    !isSearching,
  )

  const { data: searchResults, isFetching: searchFetching } = useSearchSongs(
    debouncedQuery,
    activeCategoryIds,
    { tagIds: activeTagIds },
  )

  const { data: categories } = useCategories()
  const categoryNameById = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  )

  const browseRows = useMemo<PickerRow[]>(
    () =>
      (browseData?.pages ?? []).flatMap((page) =>
        page.songs.map((song) => ({
          id: song.id,
          title: song.title,
          categoryName:
            song.categoryId != null
              ? (categoryNameById.get(song.categoryId) ?? null)
              : null,
          keyLine: song.keyLine,
        })),
      ),
    [browseData, categoryNameById],
  )

  const searchRows = useMemo<PickerRow[]>(
    () =>
      (searchResults ?? []).map((result) => ({
        id: result.id,
        title: result.title,
        categoryName: result.categoryName,
        keyLine: result.keyLine,
      })),
    [searchResults],
  )

  const totalRows = isSearching ? searchRows.length : browseRows.length
  const rows = useMemo(
    () => (isSearching ? searchRows.slice(0, visibleCount) : browseRows),
    [isSearching, searchRows, browseRows, visibleCount],
  )

  // Both modes are "there may be more": search reveals locally, browse fetches
  // the next server page.
  const hasMore = isSearching ? searchRows.length > rows.length : !!hasNextPage
  const isLoadingMore = isSearching ? false : isFetchingNextPage
  const isLoading = isSearching
    ? searchFetching && !searchResults
    : browseLoading

  const loadMore = useCallback(() => {
    if (isSearching) {
      setVisibleCount((count) => count + PAGE_SIZE)
    } else if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [isSearching, hasNextPage, isFetchingNextPage, fetchNextPage])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  // Reaching the end of what's rendered pulls the next slice in, so scrolling
  // feels continuous; the explicit button below stays as a fallback.
  const virtualItems = virtualizer.getVirtualItems()
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1]
    if (!last) return
    if (last.index >= rows.length - 5 && hasMore && !isLoadingMore) {
      loadMore()
    }
  }, [virtualItems, rows.length, hasMore, isLoadingMore, loadMore])

  return (
    <div ref={rootRef} className={`flex flex-col min-h-0 ${className}`}>
      <div className="relative flex-shrink-0 mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setVisibleCount(PAGE_SIZE)
          }}
          placeholder={t('search.placeholder')}
          data-testid="song-picker-search"
          className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        />
        {query && (
          <ClearSearchButton
            inputRef={searchInputRef}
            onClear={() => {
              setQuery('')
              setVisibleCount(PAGE_SIZE)
            }}
            size={16}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          />
        )}
      </div>

      <div className="flex-shrink-0 mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div data-testid="song-picker-category-filter" className="min-w-0">
          <SongCategoryFilter
            value={categoryIds}
            onChange={setCategoryIds}
            portalContainer={dialogEl}
          />
        </div>
        <div
          data-testid="song-picker-tag-filter"
          className="min-w-0 empty:hidden"
        >
          <SongTagFilter
            value={tagIds}
            onChange={setTagIds}
            portalContainer={dialogEl}
          />
        </div>
      </div>

      {/* Result count — makes it obvious when a search matched more than the
          first revealed page. */}
      {!isLoading && totalRows > 0 && (
        <p
          className="flex-shrink-0 mb-2 text-xs text-gray-500 dark:text-gray-400"
          data-testid="song-picker-count"
        >
          {isSearching
            ? t('picker.searchResults', {
                shown: rows.length,
                total: totalRows,
              })
            : t('picker.loadedCount', { count: rows.length })}
        </p>
      )}

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin rounded-lg border border-gray-200 dark:border-gray-700"
        data-testid="song-picker-list"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Music className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isSearching
                ? t('search.noResults', { query: debouncedQuery })
                : t('noSongs')}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setCategoryIds([])
                  setTagIds([])
                }}
                data-testid="song-picker-clear-filters"
                className="mt-3 py-2 px-4 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                {t('search.clearFiltersForMore')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: 'relative',
                width: '100%',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index]
                if (!row) return null
                return (
                  <div
                    key={row.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onSongSelect(row.id)}
                      data-testid="song-picker-row"
                      className="w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-100 dark:border-gray-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                    >
                      <Music className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                          {row.title}
                        </span>
                        {(row.categoryName || row.keyLine) && (
                          <span className="flex items-center gap-2">
                            {row.categoryName && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {row.categoryName}
                              </span>
                            )}
                            {row.keyLine && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 shrink-0">
                                {row.keyLine}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                data-testid="song-picker-load-more"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {t('picker.loadMore', { count: PAGE_SIZE })}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
