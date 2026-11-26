import { useTranslation } from 'react-i18next'

import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useAutoPresentOnSelect } from '../hooks/useAutoPresentOnSelect'

/** Settings → Bible: present a verse as soon as it is picked. */
export function AutoPresentSettings() {
  const { t } = useTranslation('bible')
  const { enabled, setEnabled } = useAutoPresentOnSelect()

  return (
    <SwitchRow
      label={t('settings.autoPresent.label')}
      description={t('settings.autoPresent.description')}
      checked={enabled}
      onCheckedChange={setEnabled}
      testId="bible-auto-present"
    />
  )
}
