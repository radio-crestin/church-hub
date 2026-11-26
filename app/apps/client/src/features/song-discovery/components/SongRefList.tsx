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
      <p className="mb-1 text-xs font-medium text-fg-hint">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((song) => (
          <li key={`${song.id ?? ''}:${song.title}`} className="min-w-0">
            {song.id ? (
              <Link
                to="/songs/$songId"
                params={{ songId: String(song.id) }}
                onClick={onOpen}
                className="block max-w-64 truncate rounded-md bg-field px-2 py-0.5 text-sm text-fg-body transition-colors hover:bg-hover hover:text-fg"
              >
                {song.title}
              </Link>
            ) : (
              <span className="block max-w-64 truncate rounded-md bg-field px-2 py-0.5 text-sm text-fg-body">
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
              className="rounded-md px-2 py-0.5 text-[13px] font-medium text-fg-label hover:bg-hover hover:text-fg"
            >
              {isOpen
                ? t('notification.showLess')
                : t('notification.showAll', { count: set.count })}
            </button>
          </li>
        )}
      </ul>
      {isOpen && unnamed > 0 && (
        <p className="mt-1 text-xs text-fg-hint">
          {t('notification.andMore', { count: unnamed })}
        </p>
      )}
    </div>
  )
}
