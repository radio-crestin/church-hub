import { useTranslation } from 'react-i18next'

import { BackgroundEditor } from '~/features/background-media'
import type { ScreenBackgroundConfig } from '~/features/presentation/types'

interface SongBackgroundFieldProps {
  /** null = the screens' own song backgrounds apply */
  value: ScreenBackgroundConfig | null
  onChange: (next: ScreenBackgroundConfig | null) => void
  portalContainer?: HTMLElement | null
}

/** The song's own background, shown behind its lyrics on the screens. */
export function SongBackgroundField({
  value,
  onChange,
  portalContainer,
}: SongBackgroundFieldProps) {
  const { t } = useTranslation('songs')

  return (
    <fieldset data-testid="song-background-section">
      <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t('editor.background.title')}
      </legend>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {t('editor.background.helper')}
      </p>
      <BackgroundEditor
        value={value}
        onChange={onChange}
        allowInherit
        portalContainer={portalContainer}
      />
    </fieldset>
  )
}
