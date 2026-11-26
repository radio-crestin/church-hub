import {
  Edit,
  Lock,
  MoreVertical,
  Power,
  PowerOff,
  QrCode,
  RefreshCw,
  ShieldCheck,
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
  const { t } = useTranslation(['settings', 'users'])
  const [menuOpen, setMenuOpen] = useState(false)

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return t('sections.users.never')
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const permissionCount = user.permissions.length

  return (
    <div
      className={`relative border rounded-xl p-4 transition-colors hover:bg-hover ${
        user.isActive ? 'border-line bg-panel' : 'border-line bg-app'
      }`}
    >
      {/* Full-card click target → opens the edit modal. It's an overlay button
          (not a wrapper) so the card's inner content keeps its semantics (the
          name stays a real heading). It sits above the content (z-10) but below
          the action column (also z-10, later in the DOM) so those buttons keep
          working. */}
      <button
        type="button"
        onClick={() => onEdit(user)}
        aria-label={`${t('sections.users.actions.edit')} — ${user.name}`}
        className="absolute inset-0 z-10 rounded-lg"
      />

      <div className="flex items-start justify-between">
        {/* Dim only the info column when inactive — NOT the whole card, so the
            actions dropdown stays opaque and isn't trapped under sibling cards
            (opacity on the root would create a stacking context). */}
        <div className={`flex-1 min-w-0 ${user.isActive ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 max-w-full truncate text-base font-medium text-fg">
              {user.name}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${
                user.isActive ? 'text-fg-label' : 'text-fg-hint'
              }`}
            >
              {user.isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              )}
              {user.isActive
                ? t('sections.users.active')
                : t('sections.users.inactive')}
            </span>
            {user.isSuperAdmin && (
              <span
                className="inline-flex items-center gap-1 text-xs text-fg-label"
                title={t('users:superAdmin')}
              >
                <ShieldCheck strokeWidth={2} size={12} />
                {t('users:superAdmin')}
              </span>
            )}
            {user.hasPassword && (
              <span
                className="inline-flex items-center gap-1 text-xs text-fg-hint"
                title={t('users:password.hasPassword')}
              >
                <Lock strokeWidth={2} size={12} />
                {t('users:password.hasPassword')}
              </span>
            )}
          </div>
          {user.roleName && (
            <p className="mt-1 text-sm text-fg-label">
              {t(`sections.users.roles.${user.roleName}`, user.roleName)}
            </p>
          )}
          <p className="text-sm text-fg-hint">
            {t('sections.users.lastUsed')}: {formatDate(user.lastUsedAt)}
          </p>
          <p className="text-sm text-fg-hint">
            {t('sections.users.permissionCount', { count: permissionCount })}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1">
          {/* QR Code button - always visible */}
          <button
            onClick={() => onShowQR(user)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg transition-colors"
            title={t('sections.users.actions.showQRCode')}
          >
            <QrCode strokeWidth={1.5} size={16} />
          </button>

          {/* More options menu */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-label hover:bg-hover hover:text-fg"
          >
            <MoreVertical strokeWidth={1.5} size={16} />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-48 bg-panel rounded-[10px] p-1 shadow-popover border border-line z-20">
                <button
                  onClick={() => {
                    onShowQR(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-fg-body hover:bg-hover"
                >
                  <QrCode strokeWidth={1.5} size={16} />
                  {t('sections.users.actions.showQRCode')}
                </button>
                <button
                  onClick={() => {
                    onEdit(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-fg-body hover:bg-hover"
                >
                  <Edit strokeWidth={1.5} size={16} />
                  {t('sections.users.actions.edit')}
                </button>
                <button
                  onClick={() => {
                    onRegenerateToken(user)
                    setMenuOpen(false)
                  }}
                  className="w-full flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-fg-body hover:bg-hover"
                >
                  <RefreshCw strokeWidth={1.5} size={16} />
                  {t('sections.users.actions.regenerateToken')}
                </button>
                {/* The super admin is always active and cannot be toggled. */}
                {!user.isSuperAdmin && (
                  <button
                    onClick={() => {
                      onToggleActive(user)
                      setMenuOpen(false)
                    }}
                    className="w-full flex h-8 items-center gap-2 rounded-lg px-2 text-sm text-fg-body hover:bg-hover"
                  >
                    {user.isActive ? (
                      <>
                        <PowerOff strokeWidth={1.5} size={16} />
                        {t('sections.users.actions.deactivate')}
                      </>
                    ) : (
                      <>
                        <Power strokeWidth={1.5} size={16} />
                        {t('sections.users.actions.activate')}
                      </>
                    )}
                  </button>
                )}
                {/* The super admin (owner) cannot be deleted. */}
                {!user.isSuperAdmin && (
                  <>
                    <div className="border-t border-line" />
                    <button
                      onClick={() => {
                        onDelete(user)
                        setMenuOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 strokeWidth={1.5} size={16} />
                      {t('sections.users.actions.delete')}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
