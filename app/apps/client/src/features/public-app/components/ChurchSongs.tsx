import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import { SongLyrics } from './SongLyrics'
import { useChurchSongs } from '../hooks/useChurchSongs'
import { matchesSearch } from '../utils/matchesSearch'

/** Enough to scroll on a phone; a search finds the rest. */
const MAX_SHOWN = 200

/** The church's songs: search by title or author, open one to read it. */
export function ChurchSongs({ readUrl }: { readUrl: string }) {
  const { t } = useTranslation('publicApp')
  const { data: songs, isLoading, isError } = useChurchSongs(readUrl)
  const [query, setQuery] = useState('')
  const [openUuid, setOpenUuid] = useState<string | null>(null)
  const shown = useMemo(
    () => (songs ?? []).filter((song) => matchesSearch(song, query)),
    [songs, query],
  )
  const open = songs?.find((song) => song.uuid === openUuid)

  if (open) return <SongLyrics song={open} onBack={() => setOpenUuid(null)} />
  if (isLoading) return <Message text={t('loading')} />
  if (isError || !songs) return <Message text={t('songs.loadFailed')} />

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
      <p className="text-xs text-fg-hint tabular-nums">
        {t('songs.count', { count: songs.length })}
      </p>
      {shown.length === 0 ? (
        <Message text={t(songs.length ? 'songs.noMatch' : 'songs.empty')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {shown.slice(0, MAX_SHOWN).map((song) => (
            <li key={song.uuid}>
              <button
                type="button"
                data-testid="church-song"
                onClick={() => setOpenUuid(song.uuid)}
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
      {shown.length > MAX_SHOWN && (
        <Message text={t('songs.more', { count: shown.length - MAX_SHOWN })} />
      )}
    </div>
  )
}

function Message({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-fg-label">{text}</p>
}
