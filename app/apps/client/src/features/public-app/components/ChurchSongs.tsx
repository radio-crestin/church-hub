import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { PcLinkStatus } from './PcLinkStatus'
import { SongLyrics } from './SongLyrics'
import { useOpenSong } from '../hooks/useOpenSong'
import { usePcLink } from '../hooks/usePcLink'
import { usePcSongEvents } from '../hooks/usePcSongEvents'
import { useSongRows } from '../hooks/useSongRows'
import type { ChurchBinding } from '../service/churchBinding'

/** Enough to scroll on a phone; a search finds the rest. */
const MAX_SHOWN = 200

/**
 * The church's songs: search by title or author, open one to read it. Live
 * from the church computer while it is reached, else from the cloud.
 */
export function ChurchSongs({ binding }: { binding: ChurchBinding }) {
  const { t } = useTranslation('publicApp')
  const link = usePcLink(binding)
  const live = link === 'live'
  const listening = usePcSongEvents(live)
  const [query, setQuery] = useState('')
  // A row's key belongs to its source (the cloud's uuid or the PC's id).
  const [opened, setOpened] = useState<{ key: string; live: boolean }>()
  const openKey = opened?.live === live ? opened.key : null
  const { rows, total, isError } = useSongRows(binding.readUrl, link, query)
  const open = useOpenSong(binding.readUrl, link, openKey)

  if (open)
    return <SongLyrics song={open} onBack={() => setOpened(undefined)} />
  // The search box stays while results load: typing goes on in it.
  const hidden = rows ? (query.trim() ? rows.length : total) - MAX_SHOWN : 0

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-fg-label"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('songs.search')}
          aria-label={t('songs.search')}
          className="h-11 pl-9"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-fg-hint tabular-nums">
          {t('songs.count', { count: total })}
        </p>
        <PcLinkStatus link={link} listening={listening} />
      </div>
      {isError ? (
        <Message text={t('songs.loadFailed')} />
      ) : !rows ? (
        <Message text={t('loading')} />
      ) : rows.length === 0 ? (
        <Message text={t(total ? 'songs.noMatch' : 'songs.empty')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {rows.slice(0, MAX_SHOWN).map((song) => (
            <li key={song.key}>
              <button
                type="button"
                data-testid="church-song"
                onClick={() => setOpened({ key: song.key, live })}
                className="flex min-h-12 w-full flex-col items-start justify-center px-3 py-2 text-left hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus focus-visible:ring-inset focus-visible:outline-none active:bg-selected"
              >
                <span className="text-sm font-medium text-fg-body">
                  {song.title}
                </span>
                {song.author && (
                  <span className="text-xs text-fg-hint">{song.author}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && <Message text={t('songs.more', { count: hidden })} />}
    </div>
  )
}

function Message({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-fg-label">{text}</p>
}
