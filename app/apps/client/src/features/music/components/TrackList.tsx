import { useTranslation } from 'react-i18next'

import { TRACK_GRID, TrackRow } from './TrackRow'
import type { LibraryTrack, MusicPlaylist } from '../types'

interface TrackListProps {
  tracks: LibraryTrack[]
  playingFileId: number | null
  playlists: MusicPlaylist[]
  onPlay: (track: LibraryTrack) => void
  onAddToQueue: (track: LibraryTrack) => void
  onAddToPlaylist: (track: LibraryTrack, playlistId: number) => void
  onCreatePlaylistWith: (track: LibraryTrack) => void
  onRemoveFromPlaylist?: (track: LibraryTrack) => void
}

/** The tracks under their column titles. */
export function TrackList({
  tracks,
  playingFileId,
  ...rowProps
}: TrackListProps) {
  const { t } = useTranslation('music')

  return (
    <div className="@container">
      <div
        className={`${TRACK_GRID} hidden px-3 pb-2 text-xs font-medium text-fg-hint @md:grid`}
      >
        <span>{t('tracks.columns.title')}</span>
        <span className="hidden @3xl:block">{t('tracks.columns.artist')}</span>
        <span>{t('tracks.columns.plays')}</span>
        <span>{t('tracks.columns.lastPlayed')}</span>
      </div>
      <div className="space-y-0.5" data-testid="music-track-list">
        {tracks.map((track) => (
          <TrackRow
            key={track.playlistItemId ?? track.id}
            track={track}
            isPlaying={track.id === playingFileId}
            {...rowProps}
          />
        ))}
      </div>
    </div>
  )
}
