import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/ui/button'
import { Input } from '~/ui/input'
import { useLibrarySongSearch } from '../hooks/useLibrarySongSearch'

interface MergeSongPickerProps {
  disabled: boolean
  onMerge: (librarySongId: string) => void
}

/** Finds a library song by title to merge the submission into. */
export function MergeSongPicker({ disabled, onMerge }: MergeSongPickerProps) {
  const { t } = useTranslation('songLibrary')
  const [query, setQuery] = useState('')
  const search = useLibrarySongSearch(query.trim(), query.trim().length > 1)

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('curator.mergeSearch')}
        aria-label={t('curator.mergeSearch')}
        data-testid="library-merge-search"
      />
      {search.data && search.data.length === 0 && (
        <p className="text-xs text-fg-hint">{t('curator.mergeNone')}</p>
      )}
      <ul className="space-y-1">
        {search.data?.map((song) => (
          <li
            key={song.id}
            className="flex items-center justify-between gap-2 text-sm text-fg"
          >
            <span className="min-w-0 truncate">{song.title}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onMerge(song.id)}
              data-testid="library-merge-into"
            >
              {t('curator.mergeInto')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
