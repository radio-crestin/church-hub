import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PairingQRCode, useUsers } from '~/features/users'
import { usePermissions } from '~/provider/permissions-provider'
import { Combobox } from '~/ui/combobox'

/**
 * Settings > Phones on the computer: pick the account a phone signs in with,
 * and show the QR code it scans (camera, or "Scan the QR code" in the app).
 */
export function ConnectPhone() {
  const { t } = useTranslation('settings')
  const { userId } = usePermissions()
  const { data: users = [], isLoading } = useUsers()
  const accounts = users.filter((user) => user.isActive)
  const [chosenId, setChosenId] = useState<number | null>(null)
  const account =
    accounts.find((user) => user.id === chosenId) ??
    accounts.find((user) => user.id === userId) ??
    accounts[0]

  if (isLoading) return null

  return (
    <div className="flex flex-col gap-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
        <li>{t('sections.phones.steps.wifi')}</li>
        <li>{t('sections.phones.steps.account')}</li>
        <li>{t('sections.phones.steps.scan')}</li>
      </ol>

      {account ? (
        <>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('sections.phones.account')}
            </label>
            <Combobox
              testId="phone-account"
              options={accounts.map((user) => ({
                value: user.id,
                label: user.name,
              }))}
              value={account.id}
              onChange={(value) => setChosenId(Number(value))}
              allowClear={false}
            />
          </div>
          <div className="max-w-md">
            <PairingQRCode key={account.id} token={account.token} />
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('sections.phones.noAccounts')}{' '}
          <Link
            to="/settings/users"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {t('sections.phones.createAccount')}
          </Link>
        </p>
      )}
    </div>
  )
}
