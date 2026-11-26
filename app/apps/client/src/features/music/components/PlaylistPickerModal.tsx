import { ListMusic, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { normalizeForSearch } from '~/utils/normalizeForSearch'
import type { LibraryTrack, MusicPlaylist } from '../types'

interface PlaylistPickerModalProps {
  /** The track being filed; null keeps the picker closed. */
  track: LibraryTrack | null
  playlists: MusicPlaylist[]
  onPick: (track: LibraryTrack, playlistId: number) => void
  onClose: () => void
}

/** Picks the playlist a track goes in, searched by name, however many there are. */
export function PlaylistPickerModal({
  track,
  playlists,
  onPick,
  onClose,
}: PlaylistPickerModalProps) {
  const { t } = useTranslation('music')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (track) {
      setQuery('')
      dialogRef.current?.showModal()
    } else {
      dialogRef.current?.close()
    }
  }, [track])

  const needle = normalizeForSearch(query.trim())
  const matches = playlists.filter((playlist) =>
    normalizeForSearch(playlist.name).includes(needle),
  )

  const pick = (playlistId: number) => {
    if (!track) return
    onPick(track, playlistId)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid="music-playlist-picker"
      aria-label={t('playlist.addTo')}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] p-0 rounded-xl border border-line bg-panel shadow-popover backdrop:bg-black/50"
    >
      {track && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-3 p-4 pb-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-fg">
                {t('playlist.addTo')}
              </h2>
              <p className="truncate text-sm text-fg-label">
                {track.title || track.filename}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('playlistPicker.close')}
              className="rounded-md p-1 text-fg-hint hover:bg-hover hover:text-fg"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="px-4 pb-3">
            <Input
              value={query}
              aria-label={t('playlistPicker.search')}
              placeholder={t('playlistPicker.search')}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches.length === 1) {
                  // Or the Enter goes on to the menu trigger focus returns
                  // to, and opens the menu again.
                  e.preventDefault()
                  pick(matches[0].id)
                }
              }}
              autoFocus
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin border-t border-line p-2">
            {matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-hint">
                {playlists.length === 0
                  ? t('playlist.empty')
                  : t('playlistPicker.noMatch')}
              </p>
            ) : (
              matches.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  onClick={() => pick(playlist.id)}
                  data-testid={`music-add-to-playlist-${playlist.id}`}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-fg hover:bg-hover focus:bg-hover focus:outline-none"
                >
                  <ListMusic
                    className="h-4 w-4 shrink-0 text-fg-label"
                    strokeWidth={1.5}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {playlist.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-fg-hint">
                    {t('tracks.count', { count: playlist.itemCount })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
