import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DevicePermissions } from './DevicePermissions'
import type {
  DevicePermissions as DevicePermissionsType,
  DeviceWithPermissions,
} from '../types'
import { getDefaultPermissions } from '../types'

interface DeviceFormProps {
  device?: DeviceWithPermissions
  onSubmit: (data: { name: string; permissions: DevicePermissionsType }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function DeviceForm({
  device,
  onSubmit,
  onCancel,
  isLoading,
}: DeviceFormProps) {
  const { t } = useTranslation('settings')
  const [name, setName] = useState(device?.name ?? '')
  const [permissions, setPermissions] = useState<DevicePermissionsType>(
    device?.permissions ?? getDefaultPermissions(),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), permissions })
  }

  const isEditing = !!device

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="device-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {t('sections.devices.deviceName')}
        </label>
        <input
          id="device-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('sections.devices.deviceNamePlaceholder')}
          disabled={isLoading}
          className="block w-full px-3 py-2 bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-600 rounded-lg
            text-gray-900 dark:text-white
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('sections.devices.permissions')}
        </label>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <DevicePermissions
            permissions={permissions}
            onChange={setPermissions}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-700 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg
            transition-colors disabled:opacity-50"
        >
          {t('sections.devices.modals.delete.cancel', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {isEditing
                ? t('sections.devices.modals.edit.submit')
                : t('sections.devices.modals.create.submit')}
            </span>
          ) : isEditing ? (
            t('sections.devices.modals.edit.submit')
          ) : (
            t('sections.devices.modals.create.submit')
          )}
        </button>
      </div>
    </form>
  )
}
