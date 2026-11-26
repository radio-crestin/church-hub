import { ListMinus, ListMusic, ListPlus, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ActionMenu, type ActionMenuItem } from '~/ui/menu'
import type { LibraryTrack } from '../types'
import { formatLastPlayed } from '../utils'

/**
 * The columns the header and the rows share, by the list's own width (its
 * panel can be narrow on a wide screen): title and buttons; then plays and
 * last played; then the artist too.
 */
export const TRACK_GRID =
  'grid-cols-[minmax(0,1fr)_2.5rem_2rem] items-center gap-x-3 @md:grid-cols-[minmax(0,1fr)_4.5rem_6.5rem_2.5rem_2rem] @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_4.5rem_6.5rem_5.5rem_2rem]'

interface TrackRowProps {
  track: LibraryTrack
  isPlaying: boolean
  onPlay: (track: LibraryTrack) => void
  onAddToQueue: (track: LibraryTrack) => void
  onPickPlaylist: (track: LibraryTrack) => void
  onCreatePlaylistWith: (track: LibraryTrack) => void
  onRemoveFromPlaylist?: (track: LibraryTrack) => void
}

/** A track: a click plays it, "+ queue" queues it, ⋮ files it in a playlist. */
export function TrackRow({
  track,
  isPlaying,
  onPlay,
  onAddToQueue,
  onPickPlaylist,
  onCreatePlaylistWith,
  onRemoveFromPlaylist,
}: TrackRowProps) {
  const { t, i18n } = useTranslation('music')
  const title = track.title || track.filename
  const lastPlayed = track.lastPlayedAt
    ? formatLastPlayed(track.lastPlayedAt, i18n.language)
    : '—'

  const menuItems: ActionMenuItem[] = [
    {
      id: 'add-to-playlist',
      label: t('playlist.addTo'),
      icon: <ListMusic className="h-4 w-4" strokeWidth={1.5} />,
      onSelect: () => onPickPlaylist(track),
      testId: 'music-add-to-playlist',
    },
    {
      id: 'new-playlist',
      label: t('tracks.newPlaylistWith'),
      icon: <Plus className="h-4 w-4" strokeWidth={1.5} />,
      onSelect: () => onCreatePlaylistWith(track),
      testId: 'music-new-playlist-with-track',
    },
    ...(onRemoveFromPlaylist
      ? [
          {
            id: 'remove-from-playlist',
            label: t('tracks.removeFromPlaylist'),
            icon: <ListMinus className="h-4 w-4" strokeWidth={1.5} />,
            onSelect: () => onRemoveFromPlaylist(track),
            testId: 'music-remove-from-playlist',
          },
        ]
      : []),
  ]

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="music-track-row"
      data-playing={isPlaying || undefined}
      onClick={() => onPlay(track)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay(track)
        }
      }}
      className={`grid ${TRACK_GRID} cursor-pointer rounded-lg px-3 py-2 text-sm transition-colors ${
        isPlaying
          ? 'bg-live-tint text-fg ring-1 ring-inset ring-live'
          : 'text-fg-body hover:bg-hover'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isPlaying && (
          <Play className="h-3.5 w-3.5 shrink-0 fill-current text-live" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium" data-testid="music-track-title">
            {title}
          </p>
          {/* Plain text, one line each, so nothing inside sticks out past
              the row while it truncates: the full meta on a narrow row, the
              artist alone once the plays and date have their own columns. */}
          <p className="truncate text-xs text-fg-hint @md:hidden">
            {[
              track.artist,
              t('tracks.plays', { count: track.playCount }),
              lastPlayed,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="hidden truncate text-xs text-fg-hint @md:block @3xl:hidden">
            {track.artist}
          </p>
        </div>
      </div>
      <span className="hidden truncate text-fg-label @3xl:block">
        {track.artist ?? '—'}
      </span>
      <span
        className="hidden tabular-nums text-fg-label @md:block"
        data-testid="music-track-plays"
      >
        {track.playCount}
      </span>
      <span
        className="hidden truncate text-fg-label @md:block"
        data-testid="music-track-last-played"
      >
        {lastPlayed}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAddToQueue(track)
        }}
        title={t('files.addToQueue')}
        data-testid="music-track-queue"
        className="flex items-center justify-self-end gap-1 rounded-lg px-2 py-1 text-xs font-medium text-fg-label hover:bg-hover hover:text-fg"
      >
        <ListPlus className="h-4 w-4" strokeWidth={1.5} />
        <span className="hidden @3xl:inline">{t('tracks.queue')}</span>
      </button>
      <div onClick={(e) => e.stopPropagation()}>
        <ActionMenu
          items={menuItems}
          label={t('tracks.more')}
          size="compact"
          testId="music-track-menu"
        />
      </div>
    </div>
  )
}
