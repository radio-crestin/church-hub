import { Music, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SongCard } from './SongCard'
import { useCategories, useSearchSongs, useSongs } from '../hooks'
import type { Song, SongSearchResult } from '../types'

const MAX_DISPLAY_SONGS = 50

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
  const { data: songs, isLoading: songsLoading } = useSongs()
  const { data: searchResults, isLoading: searchLoading } =
    useSearchSongs(searchQuery)
  const { data: categories } = useCategories()

  const isSearching = searchQuery.length > 0
  const isLoading = isSearching ? searchLoading : songsLoading

  const { displaySongs, totalCount } = useMemo(() => {
    let allSongs: Array<{
      id: number
      title: string
      categoryId: number | null
      categoryName: string | null
      matchedContent?: string
    }>

    if (isSearching && searchResults) {
      allSongs = searchResults.map((result: SongSearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
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
  }, [isSearching, searchResults, songs, categories])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value)
  }

  const hasMore = totalCount > MAX_DISPLAY_SONGS

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('search.placeholder')}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
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
              ? t('search.noResults', { query: searchQuery })
              : t('noSongs')}
          </p>
          {!isSearching && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              {t('noSongsDescription')}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isSearching
              ? t('search.resultsCount', { count: totalCount })
              : t('search.showingCount', {
                  showing: displaySongs.length,
                  total: totalCount,
                })}
          </p>
          {displaySongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onClick={() => onSongClick(song.id)}
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
