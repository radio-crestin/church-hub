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
        className="block px-4 py-2.5 hover:bg-hover"
      >
        <p className="truncate text-sm font-medium text-fg">{song.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {song.themes.map((theme) => (
            <span
              key={theme}
              data-testid="same-theme-chip"
              className="text-fg-label"
            >
              {t(`sameTheme.themes.${theme}`)}
            </span>
          ))}
          {song.categoryName ? (
            <span className="inline-flex items-center gap-1 text-fg-hint">
              <Tag className="h-3 w-3" />
              {song.categoryName}
            </span>
          ) : null}
        </div>
        {song.sharedWords.length > 0 ? (
          <p
            data-testid="same-theme-words"
            className="mt-1 truncate text-xs text-fg-hint"
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
