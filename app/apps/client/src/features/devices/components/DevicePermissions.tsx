import { useTranslation } from 'react-i18next'

import type {
  DevicePermissions as DevicePermissionsType,
  Feature,
} from '../types'
import { FEATURES } from '../types'

type PermissionLevel = 'read' | 'write' | 'delete'

interface DevicePermissionsProps {
  permissions: DevicePermissionsType
  onChange: (permissions: DevicePermissionsType) => void
  disabled?: boolean
}

const PERMISSION_LEVELS: PermissionLevel[] = ['read', 'write', 'delete']

export function DevicePermissions({
  permissions,
  onChange,
  disabled,
}: DevicePermissionsProps) {
  const { t } = useTranslation('settings')

  const handleChange = (
    feature: Feature,
    level: PermissionLevel,
    checked: boolean,
  ) => {
    const newPermissions = { ...permissions }
    newPermissions[feature] = { ...newPermissions[feature], [level]: checked }
    onChange(newPermissions)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-2 font-medium text-gray-900 dark:text-white">
              {t('sections.devices.features.title', 'Feature')}
            </th>
            {PERMISSION_LEVELS.map((level) => (
              <th
                key={level}
                className="text-center py-2 px-2 font-medium text-gray-900 dark:text-white"
              >
                {t(`sections.devices.permissionLevels.${level}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((feature) => (
            <tr
              key={feature}
              className="border-b border-gray-100 dark:border-gray-800"
            >
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                {t(`sections.devices.features.${feature}`)}
              </td>
              {PERMISSION_LEVELS.map((level) => (
                <td key={level} className="text-center py-2 px-2">
                  <input
                    type="checkbox"
                    checked={permissions[feature][level]}
                    onChange={(e) =>
                      handleChange(feature, level, e.target.checked)
                    }
                    disabled={disabled}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300
                      focus:ring-indigo-500 disabled:opacity-50 cursor-pointer
                      disabled:cursor-not-allowed"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
