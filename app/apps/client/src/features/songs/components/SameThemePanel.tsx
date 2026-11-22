import { Link } from '@tanstack/react-router'
import { ChevronDown, Compass, Loader2, Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSameThemeSongs } from '../hooks/useSameThemeSongs'
import type { SongThemeSuggestion } from '../types'

interface SameThemePanelProps {
  songId: number
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * Other songs on the same theme as the opened one (Christmas, the Cross,
 * the Lord's Supper…): each row says which theme and which words they
 * share, and opens the song. Versions of this song live in Versiuni.
 */
export function SameThemePanel({
  songId,
  isCollapsed = false,
  onToggleCollapse,
}: SameThemePanelProps) {
  const { t } = useTranslation('songs')
  const { data: songs = [], isLoading } = useSameThemeSongs(
    songId,
    !isCollapsed,
  )

  return (
    <div
      data-testid="same-theme-panel"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
    >
      <div
        data-panel-header
        className="flex flex-shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-700"
      >
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed ? t('sameTheme.expand') : t('sameTheme.collapse')
            }
            data-testid="same-theme-collapse-toggle"
            className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        ) : null}
        <Compass className="h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400" />
        <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('sameTheme.title')}
        </span>
      </div>

      {isCollapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <Loader2
              size={14}
              className="animate-spin text-gray-500 dark:text-gray-400"
            />
          ) : songs.length === 0 ? (
            <p
              data-testid="same-theme-empty"
              className="px-1 text-xs italic text-gray-400 dark:text-gray-500"
            >
              {t('sameTheme.empty')}
            </p>
          ) : (
            <ul className="space-y-1">
              {songs.map((song) => (
                <SameThemeRow key={song.songId} song={song} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SameThemeRow({ song }: { song: SongThemeSuggestion }) {
  const { t } = useTranslation('songs')
  return (
    <li data-testid="same-theme-row">
      <Link
        to="/songs/$songId"
        params={{ songId: String(song.songId) }}
        className="group block rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40"
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
