import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast'
import { isTauri } from '~/utils/isTauri'
import { createLogger } from '~/utils/logger'

const logger = createLogger('app:autostart')

/**
 * "Open Church Hub when the computer starts": the desktop app registers
 * itself with the system (tauri-plugin-autostart). Shown in the desktop app
 * only. A presentation set to start with Church Hub then begins on its own.
 */
export function AutostartSwitch() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    isEnabled()
      .then(setEnabled)
      .catch((error) => {
        logger.error('Could not read the autostart setting:', error)
      })
  }, [])

  if (!isTauri() || enabled === null) return null

  const handleChange = async (on: boolean) => {
    try {
      if (on) await enable()
      else await disable()
      setEnabled(await isEnabled())
    } catch (error) {
      logger.error('Could not change the autostart setting:', error)
      showToast(t('sections.startup.error'), 'error')
    }
  }

  return (
    <SwitchRow
      label={t('sections.startup.openOnLogin')}
      description={t('sections.startup.openOnLoginDescription')}
      checked={enabled}
      onCheckedChange={handleChange}
      testId="autostart-switch"
    />
  )
}
