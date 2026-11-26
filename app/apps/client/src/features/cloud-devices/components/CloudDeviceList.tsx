import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUsers } from '~/features/users'
import { Button } from '~/ui/button'
import { ConfirmModal } from '~/ui/modal'
import { useToast } from '~/ui/toast'
import type { useCloudDevices } from '../hooks/useCloudDevices'
import type { CloudDevice } from '../service/cloudDevicesApi'

type CloudDevicesState = ReturnType<typeof useCloudDevices>

interface CloudDeviceListProps {
  devices: CloudDevicesState['devices']
  revoke: CloudDevicesState['revoke']
}

/** The devices that joined with a link; revoking one ends its access. */
export function CloudDeviceList({ devices, revoke }: CloudDeviceListProps) {
  const { t, i18n } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: users = [] } = useUsers()
  const [toRevoke, setToRevoke] = useState<CloudDevice | null>(null)
  const joined = (devices.data ?? []).filter((device) => !device.isServer)

  const confirmRevoke = () => {
    if (!toRevoke) return
    revoke.mutate(toRevoke.id, {
      onSuccess: () => setToRevoke(null),
      onError: (error) =>
        showToast(
          t('sections.cloudDevices.revokeFailed', { error: error.message }),
          'error',
        ),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-fg">
        {t('sections.cloudDevices.devices')}
      </h3>
      {joined.length === 0 ? (
        <p className="text-sm text-fg-label">
          {t('sections.cloudDevices.none')}
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {joined.map((device) => (
            <li
              key={device.id}
              data-testid="cloud-device"
              className="flex min-h-12 items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {device.name}
                </p>
                <p className="truncate text-xs text-fg-hint">
                  {users.find((user) => user.id === device.userId)?.name ?? ''}
                  {' · '}
                  {t('sections.cloudDevices.addedOn', {
                    date: new Date(device.createdAt * 1000).toLocaleDateString(
                      i18n.language,
                    ),
                  })}
                </p>
              </div>
              {device.revokedAt ? (
                <span className="shrink-0 text-xs text-fg-hint">
                  {t('sections.cloudDevices.revoked')}
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setToRevoke(device)}
                >
                  {t('sections.cloudDevices.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        isOpen={toRevoke !== null}
        title={t('sections.cloudDevices.revokeConfirm.title')}
        message={t('sections.cloudDevices.revokeConfirm.message', {
          name: toRevoke?.name ?? '',
        })}
        confirmLabel={t('sections.cloudDevices.revoke')}
        variant="danger"
        isLoading={revoke.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => setToRevoke(null)}
        testId="cloud-device-revoke-confirm"
      />
    </div>
  )
}
