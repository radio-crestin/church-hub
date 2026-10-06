import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { SongSet } from '../service/songUpdatesApi'

/** Titles shown before "Show all". */
const FOLDED = 6

interface SongRefListProps {
  label: string
  set: SongSet
  /** After a song was opened. */
  onOpen?: () => void
}

/**
 * Some songs of a notification, by title: those in the library open on a
 * click. Folded to a few, with "Show all".
 */
export function SongRefList({ label, set, onOpen }: SongRefListProps) {
  const { t } = useTranslation('songDiscovery')
  const [isOpen, setIsOpen] = useState(false)
  if (set.count === 0) return null

  const shown = isOpen ? set.songs : set.songs.slice(0, FOLDED)
  const unnamed = set.count - set.songs.length
  const canFold = set.songs.length > FOLDED

  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((song) => (
          <li key={`${song.id ?? ''}:${song.title}`} className="min-w-0">
            {song.id ? (
              <Link
                to="/songs/$songId"
                params={{ songId: String(song.id) }}
                onClick={onOpen}
                className="block max-w-64 truncate rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-800 transition-colors hover:bg-indigo-100 hover:text-indigo-700 dark:bg-gray-700/70 dark:text-gray-100 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-200"
              >
                {song.title}
              </Link>
            ) : (
              <span className="block max-w-64 truncate rounded-md bg-gray-100 px-2 py-0.5 text-sm text-gray-800 dark:bg-gray-700/70 dark:text-gray-100">
                {song.title}
              </span>
            )}
          </li>
        ))}
        {canFold && (
          <li>
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="rounded-md px-2 py-0.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
            >
              {isOpen
                ? t('notification.showLess')
                : t('notification.showAll', { count: set.count })}
            </button>
          </li>
        )}
      </ul>
      {isOpen && unnamed > 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('notification.andMore', { count: unnamed })}
        </p>
      )}
    </div>
  )
}
