import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '~/ui/input'
import type { SongSelection } from './types'
import { useCategories } from '../../hooks/useCategories'
import { useSearchSongs } from '../../hooks/useSearchSongs'

interface SongSelectionPickerProps {
  value: SongSelection
  onChange: (selection: SongSelection) => void
  /** Prefix of the test ids, for a page with more than one picker. */
  testId?: string
}

const checkboxClass = 'h-4 w-4 shrink-0 rounded accent-primary'

/**
 * Picks whole categories (ticked) and songs one by one (searched, then
 * ticked); the songs picked stay listed under the search.
 */
export function SongSelectionPicker({
  value,
  onChange,
  testId = 'song-selection',
}: SongSelectionPickerProps) {
  const { t } = useTranslation('songs')
  const { data: categories = [] } = useCategories()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const results = useSearchSongs(debounced)
  const chosenCategories = new Set(value.categoryIds)
  const chosenSongs = new Set(value.songs.map((song) => song.id))

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const toggleCategory = (id: number) =>
    onChange({
      ...value,
      categoryIds: chosenCategories.has(id)
        ? value.categoryIds.filter((other) => other !== id)
        : [...value.categoryIds, id],
    })
  const toggleSong = (song: { id: number; title: string }) =>
    onChange({
      ...value,
      songs: chosenSongs.has(song.id)
        ? value.songs.filter((other) => other.id !== song.id)
        : [...value.songs, { id: song.id, title: song.title }],
    })

  return (
    <div className="space-y-3 text-left">
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-fg-label">
          {t('selection.categories')}
        </legend>
        <ul
          className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line p-2"
          data-testid={`${testId}-categories`}
        >
          {categories.map((category) => (
            <li key={category.id}>
              <label className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={chosenCategories.has(category.id)}
                  onChange={() => toggleCategory(category.id)}
                  className={checkboxClass}
                />
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                <span className="text-xs tabular-nums text-fg-hint">
                  {category.songCount}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-fg-label">
          {t('selection.songs')}
        </legend>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('selection.search')}
          aria-label={t('selection.search')}
          data-testid={`${testId}-search`}
        />
        {debounced && (
          <ul
            className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-line p-2"
            data-testid={`${testId}-results`}
          >
            {results.data?.length === 0 && (
              <li className="text-xs text-fg-hint">
                {t('selection.noResults')}
              </li>
            )}
            {results.data?.map((song) => (
              <li key={song.id}>
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={chosenSongs.has(song.id)}
                    onChange={() => toggleSong(song)}
                    className={checkboxClass}
                  />
                  <span className="min-w-0 flex-1 truncate">{song.title}</span>
                  {song.categoryName && (
                    <span className="truncate text-xs text-fg-hint">
                      {song.categoryName}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
        {value.songs.length > 0 && (
          <ul
            className="mt-2 flex flex-wrap gap-1"
            data-testid={`${testId}-chosen`}
          >
            {value.songs.map((song) => (
              <li
                key={song.id}
                className="flex items-center gap-1 rounded-md bg-field py-0.5 pr-1 pl-2 text-xs text-fg"
              >
                <span className="max-w-48 truncate">{song.title}</span>
                <button
                  type="button"
                  onClick={() => toggleSong(song)}
                  aria-label={t('selection.remove', { title: song.title })}
                  className="rounded p-0.5 text-fg-hint hover:text-fg"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  )
}
