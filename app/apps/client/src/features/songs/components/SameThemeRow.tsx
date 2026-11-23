import { Link } from '@tanstack/react-router'
import { Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SongThemeSuggestion } from '../types'

interface SameThemeRowProps {
  song: SongThemeSuggestion
  /** Called when the song is opened, so the list holding it can close. */
  onOpen: () => void
}

/** One song on the same theme: its title, themes and shared words; opens it. */
export function SameThemeRow({ song, onOpen }: SameThemeRowProps) {
  const { t } = useTranslation('songs')
  return (
    <li data-testid="same-theme-row">
      <Link
        to="/songs/$songId"
        params={{ songId: String(song.songId) }}
        onClick={onOpen}
        className="group block px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <p className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
          {song.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          {song.themes.map((theme) => (
            <span
              key={theme}
              data-testid="same-theme-chip"
              className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
            >
              {t(`sameTheme.themes.${theme}`)}
            </span>
          ))}
          {song.categoryName ? (
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Tag className="h-3 w-3" />
              {song.categoryName}
            </span>
          ) : null}
        </div>
        {song.sharedWords.length > 0 ? (
          <p
            data-testid="same-theme-words"
            className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400"
          >
            {t('sameTheme.sharedWords', {
              words: song.sharedWords.join(' · '),
            })}
          </p>
        ) : null}
      </Link>
    </li>
  )
}
