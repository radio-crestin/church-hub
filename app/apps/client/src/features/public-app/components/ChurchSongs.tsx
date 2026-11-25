import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('songs.search')}
          aria-label={t('songs.search')}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-9 text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('songs.count', { count: songs.length })}
      </p>
      {shown.length === 0 ? (
        <Message text={t(songs.length ? 'songs.noMatch' : 'songs.empty')} />
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {shown.slice(0, MAX_SHOWN).map((song) => (
            <li key={song.uuid}>
              <button
                type="button"
                data-testid="church-song"
                onClick={() => setOpenUuid(song.uuid)}
                className="flex w-full flex-col items-start px-3 py-3 text-left active:bg-gray-100 dark:active:bg-gray-800"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {song.title}
                </span>
                {song.author && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {song.author}
                  </span>
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
  return (
    <p className="py-8 text-center text-sm text-gray-600 dark:text-gray-400">
      {text}
    </p>
  )
}
