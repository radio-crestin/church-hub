import { Loader2, Music, SearchX } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { EmptyState } from '~/ui/page'
import { RecentSearches } from './RecentSearches'
import { SearchInput } from './SearchInput'
import { TrackList } from './TrackList'
import { ViewActionsMenu } from './ViewActionsMenu'
import {
  useAddToPlaylist,
  useLibraryTracks,
  useRecentMusicSearches,
  useRemoveFromPlaylist,
} from '../hooks'
import type { LibraryTrack, LibraryView, MusicPlaylist } from '../types'

interface TrackPanelProps {
  view: LibraryView
  viewName: string
  search: string
  onSearchChange: (search: string) => void
  playlists: MusicPlaylist[]
  playingFileId: number | null
  onPlay: (track: LibraryTrack) => void
  onAddToQueue: (tracks: LibraryTrack[]) => void
  onCreatePlaylistWith: (track: LibraryTrack) => void
  onViewRemoved: () => void
}

/** The chosen view's tracks, with a search over the whole library. */
export function TrackPanel({
  view,
  viewName,
  search,
  onSearchChange,
  playlists,
  playingFileId,
  onPlay,
  onAddToQueue,
  onCreatePlaylistWith,
  onViewRemoved,
}: TrackPanelProps) {
  const { t } = useTranslation('music')
  const query = useDebouncedValue(search.trim(), 250).debouncedValue
  const settled = useDebouncedValue(search.trim(), 1500).debouncedValue
  const { searches, remember } = useRecentMusicSearches()
  const { tracks, isLoading } = useLibraryTracks(view, query)
  const addToPlaylist = useAddToPlaylist()
  const removeFromPlaylist = useRemoveFromPlaylist()

  // A search the operator stopped typing at is worth offering again.
  useEffect(() => {
    if (settled) remember(settled)
  }, [settled, remember])

  const isSearching = query.length > 0
  const playlistId = !isSearching && view.kind === 'playlist' ? view.id : null

  const emptyTitle = isSearching
    ? t('tracks.empty.search')
    : t(`tracks.empty.${view.kind}`)

  return (
    <div
      className="flex h-full min-w-0 flex-col gap-3"
      data-testid="music-track-panel"
    >
      <SearchInput
        value={search}
        onChange={onSearchChange}
        onSubmit={remember}
        placeholder={t('tracks.search')}
      />
      <RecentSearches searches={searches} onPick={onSearchChange} />
      <div className="flex items-center gap-2">
        <h2
          className="min-w-0 flex-1 truncate font-semibold text-fg"
          data-testid="music-view-title"
        >
          {isSearching ? t('tracks.resultsFor', { query }) : viewName}
        </h2>
        {!isSearching && (
          <ViewActionsMenu
            view={view}
            name={viewName}
            tracks={tracks}
            onAddToQueue={onAddToQueue}
            onRemoved={onViewRemoved}
          />
        )}
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-fg-hint" />
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={isSearching ? SearchX : Music}
          title={emptyTitle}
          hint={isSearching ? undefined : t(`tracks.emptyHint.${view.kind}`)}
        />
      ) : (
        <>
          <TrackList
            tracks={tracks}
            playingFileId={playingFileId}
            playlists={playlists}
            onPlay={onPlay}
            onAddToQueue={(track) => onAddToQueue([track])}
            onAddToPlaylist={(track, id) =>
              addToPlaylist.mutate({ playlistId: id, fileId: track.id })
            }
            onCreatePlaylistWith={onCreatePlaylistWith}
            onRemoveFromPlaylist={
              playlistId === null
                ? undefined
                : (track) =>
                    track.playlistItemId !== undefined &&
                    removeFromPlaylist.mutate({
                      playlistId,
                      itemId: track.playlistItemId,
                    })
            }
          />
          <p className="px-3 text-xs text-fg-hint">{t('tracks.hint')}</p>
        </>
      )}
    </div>
  )
}
