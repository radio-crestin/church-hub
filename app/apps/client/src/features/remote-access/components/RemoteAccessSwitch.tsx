import { useTranslation } from 'react-i18next'

import { usePermissions } from '~/provider/permissions-provider'
import { SwitchRow } from '~/ui/switch/SwitchRow'
import { useRemoteAccess } from '../hooks/useRemoteAccess'

/**
 * Settings > Phones: whether paired phones reach this computer from
 * anywhere, over the internet (a WebRTC tunnel through the church's relay).
 */
export function RemoteAccessSwitch() {
  const { t } = useTranslation('settings')
  const { hasPermission } = usePermissions()
  const { remoteAccess, setEnabled, isSaving } = useRemoteAccess()

  return (
    <SwitchRow
      label={t('sections.phones.remote.label')}
      description={t('sections.phones.remote.description')}
      checked={remoteAccess?.enabled ?? false}
      onCheckedChange={setEnabled}
      disabled={!remoteAccess || isSaving || !hasPermission('users.edit')}
      testId="remote-access-switch"
    />
  )
}
