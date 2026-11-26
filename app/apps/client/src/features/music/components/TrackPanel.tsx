import { Loader2, Music, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebouncedValue } from '~/hooks/useDebouncedValue'
import { EmptyState } from '~/ui/page'
import { MusicSection } from './MusicSection'
import { PlaylistPickerModal } from './PlaylistPickerModal'
import { RecentSearches } from './RecentSearches'
import { Scrollable } from './Scrollable'
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
  /** The list scrolls under a fixed search and title (large screens). */
  scrollable: boolean
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
  scrollable,
}: TrackPanelProps) {
  const { t } = useTranslation('music')
  const query = useDebouncedValue(search.trim(), 250).debouncedValue
  const settled = useDebouncedValue(search.trim(), 1500).debouncedValue
  const { searches, remember } = useRecentMusicSearches()
  const { tracks, isLoading } = useLibraryTracks(view, query)
  const addToPlaylist = useAddToPlaylist()
  const removeFromPlaylist = useRemoveFromPlaylist()
  const [pickingFor, setPickingFor] = useState<LibraryTrack | null>(null)

  // A search the operator stopped typing at is worth offering again.
  useEffect(() => {
    if (settled) remember(settled)
  }, [settled, remember])

  const isSearching = query.length > 0
  const playlistId = !isSearching && view.kind === 'playlist' ? view.id : null

  const emptyTitle = isSearching
    ? t('tracks.empty.search')
    : t(`tracks.empty.${view.kind}`)

  const results = isLoading ? (
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
        onPlay={onPlay}
        onAddToQueue={(track) => onAddToQueue([track])}
        onPickPlaylist={setPickingFor}
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
      <p className="px-3 pt-2 text-xs text-fg-hint">{t('tracks.hint')}</p>
    </>
  )

  return (
    <div
      className="flex min-w-0 flex-col divide-y divide-line lg:flex-1 lg:min-h-0"
      data-testid="music-track-panel"
    >
      <div className="flex shrink-0 flex-col gap-2 p-2.5">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          onSubmit={remember}
          placeholder={t('tracks.search')}
        />
        <RecentSearches searches={searches} onPick={onSearchChange} />
      </div>
      <MusicSection
        title={isSearching ? t('tracks.resultsFor', { query }) : viewName}
        count={isLoading ? undefined : tracks.length}
        countLabel={t('tracks.count', { count: tracks.length })}
        actions={
          !isSearching && (
            <ViewActionsMenu
              view={view}
              name={viewName}
              tracks={tracks}
              onAddToQueue={onAddToQueue}
              onRemoved={onViewRemoved}
            />
          )
        }
        className="lg:flex-1 lg:min-h-0"
        testId="music-view"
      >
        <Scrollable enabled={scrollable}>{results}</Scrollable>
      </MusicSection>
      <PlaylistPickerModal
        track={pickingFor}
        playlists={playlists}
        onPick={(track, playlistId) =>
          addToPlaylist.mutate({ playlistId, fileId: track.id })
        }
        onClose={() => setPickingFor(null)}
      />
    </div>
  )
}
