import { useTranslation } from 'react-i18next'

import {
  EMPTY_SONG_SELECTION,
  type SongSelection,
  SongSelectionPicker,
} from '~/features/songs/components/SongSelectionPicker'

interface ShareScopePickerProps {
  /** null: the whole library. */
  value: SongSelection | null
  onChange: (value: SongSelection | null) => void
}

/** What a share holds: the whole library, or the categories and songs picked. */
export function ShareScopePicker({ value, onChange }: ShareScopePickerProps) {
  const { t } = useTranslation('songDiscovery')

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{t('songSources.share.scope')}</legend>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="radio"
          name="share-scope"
          checked={value === null}
          onChange={() => onChange(null)}
          className="accent-primary"
        />
        {t('songSources.share.wholeLibrary')}
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="radio"
          name="share-scope"
          checked={value !== null}
          onChange={() => onChange(EMPTY_SONG_SELECTION)}
          className="accent-primary"
        />
        {t('songSources.share.chosenSongs')}
      </label>
      {value !== null && (
        <div className="sm:ml-6">
          <SongSelectionPicker
            value={value}
            onChange={onChange}
            testId="share-selection"
          />
        </div>
      )}
    </fieldset>
  )
}
