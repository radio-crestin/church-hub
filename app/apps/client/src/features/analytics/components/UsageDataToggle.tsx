import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useToast } from '~/ui/toast'
import { useAnalyticsConsent } from '../hooks/useAnalyticsConsent'

/** "Share anonymous usage data": on by default, for the whole install. */
export function UsageDataToggle() {
  const { t } = useTranslation('privacy')
  const { hasPermission } = usePermissions()
  const { showToast } = useToast()
  const { enabled, isLoading, isSaving, setEnabled } = useAnalyticsConsent()
  const canEdit = hasPermission('settings.edit')

  const onChange = async (checked: boolean) => {
    try {
      await setEnabled(checked)
      showToast(t('toggle.saved'), 'success')
    } catch {
      showToast(t('toggle.saveFailed'), 'error')
    }
  }

  return (
    <div>
      <SwitchRow
        label={t('toggle.label')}
        description={t('toggle.description')}
        checked={enabled}
        onCheckedChange={onChange}
        disabled={!canEdit || isLoading || isSaving}
        testId="usage-data-toggle"
      />
      {!canEdit && (
        <p className="text-xs text-fg-hint">{t('toggle.needsPermission')}</p>
      )}
    </div>
  )
}
