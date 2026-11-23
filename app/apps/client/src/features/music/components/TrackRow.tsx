import { ListMinus, ListMusic, ListPlus, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ActionMenu, type ActionMenuItem } from '~/ui/menu'
import type { LibraryTrack, MusicPlaylist } from '../types'
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
  playlists: MusicPlaylist[]
  onPlay: (track: LibraryTrack) => void
  onAddToQueue: (track: LibraryTrack) => void
  onAddToPlaylist: (track: LibraryTrack, playlistId: number) => void
  onCreatePlaylistWith: (track: LibraryTrack) => void
  onRemoveFromPlaylist?: (track: LibraryTrack) => void
}

/** A track: a click plays it, "+ queue" queues it, ⋮ files it in a playlist. */
export function TrackRow({
  track,
  isPlaying,
  playlists,
  onPlay,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylistWith,
  onRemoveFromPlaylist,
}: TrackRowProps) {
  const { t, i18n } = useTranslation('music')
  const title = track.title || track.filename
  const lastPlayed = track.lastPlayedAt
    ? formatLastPlayed(track.lastPlayedAt, i18n.language)
    : '—'

  const menuItems: ActionMenuItem[] = [
    ...playlists.map((playlist) => ({
      id: `playlist-${playlist.id}`,
      label: t('tracks.addToPlaylist', { name: playlist.name }),
      icon: <ListMusic className="h-4 w-4" />,
      onSelect: () => onAddToPlaylist(track, playlist.id),
      testId: `music-add-to-playlist-${playlist.id}`,
    })),
    {
      id: 'new-playlist',
      label: t('tracks.newPlaylistWith'),
      icon: <Plus className="h-4 w-4" />,
      onSelect: () => onCreatePlaylistWith(track),
      testId: 'music-new-playlist-with-track',
    },
    ...(onRemoveFromPlaylist
      ? [
          {
            id: 'remove-from-playlist',
            label: t('tracks.removeFromPlaylist'),
            icon: <ListMinus className="h-4 w-4" />,
            iconClassName: 'text-red-600 dark:text-red-400',
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
          ? 'bg-indigo-600 text-white'
          : 'text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700/60'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isPlaying && <Play className="h-3.5 w-3.5 shrink-0 fill-current" />}
        <div className="min-w-0">
          <p className="truncate font-medium" data-testid="music-track-title">
            {title}
          </p>
          <p
            className={`truncate text-xs @3xl:hidden ${isPlaying ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {track.artist}
            <span className="@md:hidden">
              {track.artist ? ' · ' : ''}
              {t('tracks.plays', { count: track.playCount })} · {lastPlayed}
            </span>
          </p>
        </div>
      </div>
      <span className="hidden truncate @3xl:block">{track.artist ?? '—'}</span>
      <span
        className="hidden tabular-nums @md:block"
        data-testid="music-track-plays"
      >
        {track.playCount}
      </span>
      <span
        className="hidden truncate @md:block"
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
        className={`flex items-center justify-self-end gap-1 rounded-md px-2 py-1 text-xs font-medium ${
          isPlaying
            ? 'hover:bg-white/20'
            : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        <ListPlus className="h-4 w-4" />
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
