import { useTranslation } from 'react-i18next'

import { Switch } from '~/ui/switch/Switch'
import { useAppShortcuts } from '../hooks'

type ShortcutSwitchSetting = 'onlyWhenAppFocused' | 'sidebarKeysSystemWide'

interface ShortcutConfigSwitchProps {
  setting: ShortcutSwitchSetting
  /** i18n key under `settings:` that holds `label` and `description` */
  textKey: string
}

/** One on/off setting of the shortcuts config, saved as soon as it flips. */
export function ShortcutConfigSwitch({
  setting,
  textKey,
}: ShortcutConfigSwitchProps) {
  const { t } = useTranslation('settings')
  const { shortcuts, isLoading, isSaving, updateFullConfig } = useAppShortcuts()
  const switchId = `shortcuts-${setting}`

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
      <div>
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-gray-900 dark:text-white"
        >
          {t(`${textKey}.label`)}
        </label>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          {t(`${textKey}.description`)}
        </p>
      </div>
      <Switch
        id={switchId}
        checked={shortcuts[setting] ?? false}
        disabled={isLoading || isSaving}
        onCheckedChange={(checked) =>
          updateFullConfig({ ...shortcuts, [setting]: checked })
        }
      />
    </div>
  )
}
