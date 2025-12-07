import { Music, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SongCard } from './SongCard'
import { useCategories, useSearchSongs, useSongs } from '../hooks'
import type { Song, SongSearchResult } from '../types'

interface SongListProps {
  onSongClick: (songId: number) => void
}

export function SongList({ onSongClick }: SongListProps) {
  const { t } = useTranslation('songs')
  const [searchQuery, setSearchQuery] = useState('')
  const { data: songs, isLoading: songsLoading } = useSongs()
  const { data: searchResults, isLoading: searchLoading } =
    useSearchSongs(searchQuery)
  const { data: categories } = useCategories()

  const isSearching = searchQuery.length > 0
  const isLoading = isSearching ? searchLoading : songsLoading

  const displaySongs = useMemo(() => {
    if (isSearching && searchResults) {
      return searchResults.map((result: SongSearchResult) => ({
        id: result.id,
        title: result.title,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        matchedContent: result.matchedContent,
      }))
    }
    return (
      songs?.map((song: Song) => ({
        id: song.id,
        title: song.title,
        categoryId: song.categoryId,
        categoryName:
          categories?.find((c) => c.id === song.categoryId)?.name ?? null,
      })) ?? []
    )
  }, [isSearching, searchResults, songs, categories])

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
          {isSearching && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('search.resultsCount', { count: displaySongs.length })}
            </p>
          )}
          {displaySongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onClick={() => onSongClick(song.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
