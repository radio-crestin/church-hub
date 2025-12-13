import {
  Edit,
  MoreVertical,
  Power,
  PowerOff,
  QrCode,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { UserWithPermissions } from '../types'

interface UserCardProps {
  user: UserWithPermissions
  onEdit: (user: UserWithPermissions) => void
  onDelete: (user: UserWithPermissions) => void
  onShowQR: (user: UserWithPermissions) => void
  onRegenerateToken: (user: UserWithPermissions) => void
  onToggleActive: (user: UserWithPermissions) => void
}

export function UserCard({
  user,
  onEdit,
  onDelete,
  onShowQR,
  onRegenerateToken,
  onToggleActive,
}: UserCardProps) {
  const { t } = useTranslation('settings')
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return t('sections.users.never')
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const permissionCount = user.permissions.length

  return (
    <div
      className={`relative border rounded-lg p-4 ${
        user.isActive
          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
              {user.name}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                user.isActive
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              {user.isActive
                ? t('sections.users.active')
                : t('sections.users.inactive')}
            </span>
          </div>
          {user.roleName && (
            <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
              {t(`sections.users.roles.${user.roleName}`, user.roleName)}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('sections.users.lastUsed')}: {formatDate(user.lastUsedAt)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {permissionCount} {t('sections.users.permissions').toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* QR Code button - always visible */}
          <button
            onClick={() => onShowQR(user)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={t('sections.users.actions.showQRCode')}
          >
            <QrCode
              size={20}
              className="text-indigo-600 dark:text-indigo-400"
            />
          </button>

          {/* More options menu */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical
              size={20}
              className="text-gray-500 dark:text-gray-400"
            />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                <button
                  onClick={() => {
                    onShowQR(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <QrCode size={16} />
                  {t('sections.users.actions.showQRCode')}
                </button>
                <button
                  onClick={() => {
                    onEdit(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Edit size={16} />
                  {t('sections.users.actions.edit')}
                </button>
                <button
                  onClick={() => {
                    onRegenerateToken(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RefreshCw size={16} />
                  {t('sections.users.actions.regenerateToken')}
                </button>
                <button
                  onClick={() => {
                    onToggleActive(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {user.isActive ? (
                    <>
                      <PowerOff size={16} />
                      {t('sections.users.actions.deactivate')}
                    </>
                  ) : (
                    <>
                      <Power size={16} />
                      {t('sections.users.actions.activate')}
                    </>
                  )}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => {
                    onDelete(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={16} />
                  {t('sections.users.actions.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
