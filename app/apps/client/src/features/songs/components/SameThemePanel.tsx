import { Link } from '@tanstack/react-router'
import { ChevronDown, Loader2, Shapes } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { VersionRowInfo } from './VersionRowInfo'
import { useSameThemeSongs } from '../hooks/useSameThemeSongs'

interface SameThemePanelProps {
  songId: number
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

/**
 * "Pe aceeași temă": other songs on the song's theme (sharing the rarest
 * words of its title and lyrics), best first; a click opens one. Versions of
 * the song are in Versiuni, not here.
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
            className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        ) : null}
        <Shapes className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
        <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('sameTheme.title')}
        </span>
      </div>

      {isCollapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-gray-500" />
          ) : songs.length === 0 ? (
            <p className="px-1 text-xs italic text-gray-400 dark:text-gray-500">
              {t('sameTheme.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {songs.map((song) => (
                <li
                  key={song.songId}
                  data-testid="same-theme-row"
                  className="group relative rounded-lg border border-gray-200 px-3 py-2 transition-colors hover:border-indigo-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-indigo-500/40 dark:hover:bg-gray-700/40"
                >
                  <Link
                    to="/songs/$songId"
                    params={{ songId: String(song.songId) }}
                    aria-label={song.title}
                    className="absolute inset-0 rounded-lg"
                  />
                  <div className="min-w-0">
                    <VersionRowInfo {...song} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
