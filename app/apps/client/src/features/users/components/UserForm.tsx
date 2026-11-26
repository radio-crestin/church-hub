import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { UserPermissions } from './UserPermissions'
import type { Permission, RoleTemplate, UserWithPermissions } from '../types'
import { ROLE_TEMPLATES } from '../types'

export interface UserFormData {
  name: string
  permissions: Permission[]
  /**
   * Password change intent:
   *  - undefined: leave the password unchanged
   *  - null: remove the password
   *  - string: set this password
   */
  password?: string | null
}

interface UserFormProps {
  user?: UserWithPermissions
  onSubmit: (data: UserFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: UserFormProps) {
  const { t } = useTranslation(['settings', 'users'])
  const [name, setName] = useState(user?.name ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [removePassword, setRemovePassword] = useState(false)
  const [permissions, setPermissions] = useState<Permission[]>(
    user?.permissions ?? [],
  )
  const [selectedRole, setSelectedRole] = useState<RoleTemplate | null>(() => {
    // Try to detect if current permissions match a role template
    if (!user?.permissions) return null
    for (const [role, rolePerms] of Object.entries(ROLE_TEMPLATES)) {
      if (
        rolePerms.length === user.permissions.length &&
        rolePerms.every((p) => user.permissions.includes(p))
      ) {
        return role as RoleTemplate
      }
    }
    return null
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    let passwordChange: string | null | undefined
    if (removePassword) {
      passwordChange = null
    } else if (password.length > 0) {
      passwordChange = password
    } else {
      passwordChange = undefined
    }

    onSubmit({ name: name.trim(), permissions, password: passwordChange })
  }

  const isEditing = !!user

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 overflow-y-auto px-6 py-5">
        <div>
          <label
            htmlFor="user-name"
            className="block text-sm font-medium text-fg-body mb-1"
          >
            {t('sections.users.userName')}
          </label>
          <input
            id="user-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('sections.users.userNamePlaceholder')}
            disabled={isLoading}
            className="block w-full h-9 px-3 bg-field
            border-0 rounded-[10px] text-sm
            text-fg placeholder:text-fg-hint
            focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
            disabled:opacity-50"
            autoFocus
          />
        </div>

        <div>
          <label
            htmlFor="user-password"
            className="block text-sm font-medium text-fg-body mb-1"
          >
            {t('users:password.label')}{' '}
            <span className="text-fg-hint font-normal">
              ({t('users:password.optional')})
            </span>
          </label>
          <div className="relative">
            <input
              id="user-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isEditing && user?.hasPassword
                  ? t('users:password.changePlaceholder')
                  : t('users:password.setPlaceholder')
              }
              disabled={isLoading || removePassword}
              autoComplete="new-password"
              className="block w-full h-9 pl-3 pr-11 bg-field
              border-0 rounded-[10px] text-sm
              text-fg placeholder:text-fg-hint
              focus:outline-none focus:ring-1 focus:ring-inset focus:ring-focus
              disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              disabled={isLoading || removePassword}
              aria-label={
                showPassword
                  ? t('users:password.hide')
                  : t('users:password.show')
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-hint transition-colors hover:bg-hover hover:text-fg-label disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-fg-hint"
            >
              {showPassword ? (
                <EyeOff strokeWidth={1.5} className="h-4 w-4" />
              ) : (
                <Eye strokeWidth={1.5} className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-fg-hint mt-1">
            {t('users:password.hint')}
          </p>
          {isEditing && user?.hasPassword && (
            <label className="flex items-center gap-2 mt-2 text-sm text-fg-body">
              <input
                type="checkbox"
                checked={removePassword}
                onChange={(e) => setRemovePassword(e.target.checked)}
                disabled={isLoading}
                className="rounded border-line accent-primary text-primary focus:ring-focus"
              />
              {t('users:password.remove')}
            </label>
          )}
        </div>

        <UserPermissions
          permissions={permissions}
          onChange={setPermissions}
          disabled={isLoading}
          selectedRole={selectedRole}
          onRoleChange={setSelectedRole}
        />
      </div>

      {/* Sticky footer — Close (cancel) and the primary Save action. */}
      <div className="flex shrink-0 justify-end gap-3 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-9 px-3.5 text-sm font-medium bg-field text-fg
            hover:bg-hover rounded-lg
            transition-colors disabled:opacity-50"
        >
          {t('users:profile.close')}
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="h-9 px-3.5 text-sm font-medium bg-primary hover:bg-indigo-700 text-white rounded-lg
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {isEditing
                ? t('sections.users.modals.edit.submit')
                : t('sections.users.modals.create.submit')}
            </span>
          ) : isEditing ? (
            t('sections.users.modals.edit.submit')
          ) : (
            t('sections.users.modals.create.submit')
          )}
        </button>
      </div>
    </form>
  )
}
