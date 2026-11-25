import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LinkQRCode, useUsers } from '~/features/users'
import { Button } from '~/ui/button'
import { Combobox } from '~/ui/combobox'
import { Input } from '~/ui/input'
import { useToast } from '~/ui/toast'
import type { useCloudDevices } from '../hooks/useCloudDevices'

interface AddCloudDeviceProps {
  add: ReturnType<typeof useCloudDevices>['add']
}

/**
 * "Add a device": the account it writes as and a name to tell it apart, then
 * the join link and its QR code (shown once: the token is in it).
 */
export function AddCloudDevice({ add }: AddCloudDeviceProps) {
  const { t } = useTranslation('settings')
  const { showToast } = useToast()
  const { data: users = [] } = useUsers()
  const accounts = users.filter((user) => user.isActive)
  const [userId, setUserId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const account = accounts.find((user) => user.id === userId) ?? accounts[0]

  const create = () => {
    if (!account) return
    add.mutate(
      { userId: account.id, name: name.trim() || account.name },
      {
        onError: (error) =>
          showToast(
            t('sections.cloudDevices.createFailed', { error: error.message }),
            'error',
          ),
      },
    )
  }

  if (add.data) {
    return (
      <div className="flex max-w-md flex-col gap-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t('sections.cloudDevices.linkHint')}
        </p>
        <LinkQRCode url={add.data.joinUrl} testId="join-qr" />
        <Button variant="secondary" onClick={() => add.reset()}>
          {t('sections.cloudDevices.another')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex max-w-md flex-col gap-3">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('sections.cloudDevices.account')}
        </label>
        <Combobox
          testId="cloud-device-account"
          options={accounts.map((user) => ({
            value: user.id,
            label: user.name,
          }))}
          value={account?.id ?? null}
          onChange={(value) => setUserId(Number(value))}
          allowClear={false}
        />
      </div>
      <div>
        <label
          htmlFor="cloud-device-name"
          className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {t('sections.cloudDevices.name')}
        </label>
        <Input
          id="cloud-device-name"
          value={name}
          maxLength={200}
          placeholder={t('sections.cloudDevices.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <Button
        onClick={create}
        disabled={!account || add.isPending}
        data-testid="cloud-device-create"
      >
        {add.isPending
          ? t('sections.cloudDevices.creating')
          : t('sections.cloudDevices.create')}
      </Button>
    </div>
  )
}
