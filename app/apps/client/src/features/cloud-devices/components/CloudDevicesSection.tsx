import { useTranslation } from 'react-i18next'

import { useSyncStatus } from '~/features/sync'
import { usePermissions } from '~/provider/permissions-provider'
import { Button } from '~/ui/button'
import { useToast } from '~/ui/toast'
import { AddCloudDevice } from './AddCloudDevice'
import { CloudDeviceList } from './CloudDeviceList'
import { CloudMediaVideosSwitch } from './CloudMediaVideosSwitch'
import { useCloudDevices, useConnectCloud } from '../hooks/useCloudDevices'

/**
 * Settings > Phones > Join with a link (T-168): a phone or browser opens the
 * link on the public app and is bound to this church on the cloud sync
 * service, with the chosen account's permissions.
 */
export function CloudDevicesSection() {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { hasPermission } = usePermissions()
  const { data: status, isLoading } = useSyncStatus()
  const connected = status?.transport === 'cloud' && status.cloud !== null
  const { devices, add, revoke } = useCloudDevices(connected)
  const connect = useConnectCloud()

  if (isLoading) return null

  if (!connected) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-fg-body">
          {t('sections.cloudDevices.notConnected')}
        </p>
        <Button
          onClick={() =>
            connect.mutate(undefined, {
              onError: (error) =>
                showToast(
                  t('sections.cloudDevices.connectFailed', {
                    error: error.message,
                  }),
                  'error',
                ),
            })
          }
          disabled={connect.isPending || !hasPermission('users.edit')}
          data-testid="cloud-connect"
        >
          {connect.isPending
            ? t('sections.cloudDevices.connecting')
            : t('sections.cloudDevices.connect')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AddCloudDevice add={add} />
      <CloudDeviceList devices={devices} revoke={revoke} />
      <CloudMediaVideosSwitch />
    </div>
  )
}
