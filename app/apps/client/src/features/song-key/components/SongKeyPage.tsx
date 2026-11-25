import { Loader2, Music, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { EmptyState, Page, PageHeader, PagePanel } from '~/ui/page'
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
    <Page>
      <PageHeader
        title={t('title')}
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            title={t('actions.refresh')}
            aria-label={t('actions.refresh')}
          >
            <RefreshCw
              size={20}
              className={isRefetching ? 'animate-spin' : ''}
            />
          </Button>
        }
      />

      <PagePanel testId="song-key-list">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fg-hint" />
          </div>
        ) : allSongs.length === 0 ? (
          <EmptyState
            icon={Music}
            title={t('emptyState.title')}
            hint={t('emptyState.description')}
          />
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-fg-hint">
              {t('songCount', { count: totalCount })}
            </p>

            {groupedSongs.map((group) => (
              <div key={group.dateKey}>
                {/* Date Header */}
                <div className="bg-app/95 py-2 px-3 rounded-lg mb-3">
                  <h2 className="text-sm font-semibold text-fg-label">
                    {group.dateLabel}
                  </h2>
                </div>

                {/* Songs in group */}
                <div className="grid gap-2">
                  {group.songs.map((song) => (
                    <button
                      key={song.id}
                      data-testid="song-key-row"
                      onClick={() => handleSongClick(song)}
                      className="w-full flex items-center justify-between px-3 sm:px-4 py-3 rounded-lg
                        bg-panel border border-line
                        hover:border-line-strong
                        hover:bg-hover
                        transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-fg truncate">
                          {song.title}
                        </p>
                        <p className="text-xs text-fg-hint">
                          {t('presentedCount', {
                            count: song.presentationCount,
                          })}
                        </p>
                      </div>
                      <div className="ml-2 sm:ml-4 flex-shrink-0">
                        {song.keyLine ? (
                          <span className="text-sm font-medium text-key">
                            {song.keyLine}
                          </span>
                        ) : (
                          <span className="px-2 sm:px-3 py-1 text-sm rounded-full bg-field text-fg-hint">
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
                  <Loader2 className="w-6 h-6 text-fg-hint animate-spin" />
                )}
              </div>
            )}
          </div>
        )}
      </PagePanel>

      {/* Edit Dialog */}
      <KeyLineEditDialog ref={dialogRef} />
    </Page>
  )
}
