import { useTranslation } from 'react-i18next'

import { Switch } from '~/ui/switch/Switch'
import { useAppShortcuts } from '../hooks'

const SWITCH_ID = 'shortcuts-only-when-app-focused'

/**
 * Chooses whether presentation, livestream and OBS scene keys keep working
 * while another program is in front (the default) or only inside Church Hub.
 */
export function ShortcutFocusOnlyToggle() {
  const { t } = useTranslation('settings')
  const { shortcuts, isLoading, isSaving, updateFullConfig } = useAppShortcuts()

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
      <div>
        <label
          htmlFor={SWITCH_ID}
          className="text-sm font-medium text-gray-900 dark:text-white"
        >
          {t('sections.shortcuts.focusOnly.label')}
        </label>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {t('sections.shortcuts.focusOnly.description')}
        </p>
      </div>
      <Switch
        id={SWITCH_ID}
        checked={shortcuts.onlyWhenAppFocused ?? false}
        disabled={isLoading || isSaving}
        onCheckedChange={(onlyWhenAppFocused) =>
          updateFullConfig({ ...shortcuts, onlyWhenAppFocused })
        }
      />
    </div>
  )
}
