import { Loader2, Music, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import {
  KeyLineEditDialog,
  type KeyLineEditDialogHandle,
} from './KeyLineEditDialog'
import type { Song } from '../../songs/types'
import { usePresentedSongs } from '../hooks/usePresentedSongs'

interface SongGroup {
  dateKey: string
  dateLabel: string
  songs: Song[]
}

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getDateLabel(
  timestamp: number,
  t: (key: string, options?: Record<string, unknown>) => string,
  language: string,
): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const songDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (songDate.getTime() === today.getTime()) {
    return t('dateGroups.today')
  }
  if (songDate.getTime() === yesterday.getTime()) {
    return t('dateGroups.yesterday')
  }

  // Return full date for all other days using the app's configured language
  return date.toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function SongKeyPage() {
  const { t, i18n } = useTranslation('songKey')
  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePresentedSongs()
  const dialogRef = useRef<KeyLineEditDialogHandle>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Called synchronously from user click - this is critical for iOS keyboard
  const handleSongClick = (song: Song) => {
    dialogRef.current?.open(song)
  }

  // Flatten all pages into a single array
  const allSongs = useMemo(() => {
    return data?.pages.flatMap((page) => page.songs) ?? []
  }, [data])

  const totalCount = data?.pages[0]?.total ?? 0

  // Group songs by last presented date
  const groupedSongs = useMemo((): SongGroup[] => {
    const groups = new Map<string, Song[]>()

    for (const song of allSongs) {
      // Use lastPresentedAt if available, fallback to updatedAt for legacy data
      const timestamp = song.lastPresentedAt ?? song.updatedAt
      const dateKey = getDateKey(timestamp)
      const existing = groups.get(dateKey) ?? []
      existing.push(song)
      groups.set(dateKey, existing)
    }

    // Sort groups by date (newest first)
    const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
      b.localeCompare(a),
    )

    return sortedKeys.map((dateKey) => {
      const songs = groups.get(dateKey)!
      const firstSong = songs[0]
      const timestamp = firstSong.lastPresentedAt ?? firstSong.updatedAt
      return {
        dateKey,
        dateLabel: getDateLabel(timestamp, t, i18n.language),
        songs,
      }
    })
  }, [allSongs, t, i18n.language])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' },
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Music className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
            {t('title')}
          </h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700
            disabled:opacity-50 transition-colors"
          title={t('actions.refresh')}
        >
          <RefreshCw size={20} className={isRefetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-4 sm:px-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : allSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <Music size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">{t('emptyState.title')}</p>
            <p className="text-sm">{t('emptyState.description')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('songCount', { count: totalCount })}
            </p>

            {groupedSongs.map((group) => (
              <div key={group.dateKey}>
                {/* Date Header */}
                <div className="bg-gray-50/95 dark:bg-gray-900/95 py-2 px-3 rounded-lg mb-3">
                  <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    {group.dateLabel}
                  </h2>
                </div>

                {/* Songs in group */}
                <div className="grid gap-2">
                  {group.songs.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => handleSongClick(song)}
                      className="w-full flex items-center justify-between px-3 sm:px-4 py-3 rounded-lg
                        bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                        hover:border-indigo-300 dark:hover:border-indigo-600
                        hover:bg-indigo-50 dark:hover:bg-indigo-900/20
                        transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {song.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('presentedCount', {
                            count: song.presentationCount,
                          })}
                        </p>
                      </div>
                      <div className="ml-2 sm:ml-4 flex-shrink-0">
                        {song.keyLine ? (
                          <span className="px-2 sm:px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                            {song.keyLine}
                          </span>
                        ) : (
                          <span className="px-2 sm:px-3 py-1 text-sm rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            {t('noKeyLine')}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Infinite scroll trigger */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="py-4 flex justify-center">
                {isFetchingNextPage && (
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <KeyLineEditDialog ref={dialogRef} />
    </div>
  )
}
