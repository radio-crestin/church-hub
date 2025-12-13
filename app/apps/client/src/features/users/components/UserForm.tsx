import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { UserPermissions } from './UserPermissions'
import type { Permission, RoleTemplate, UserWithPermissions } from '../types'
import { ROLE_TEMPLATES } from '../types'

interface UserFormProps {
  user?: UserWithPermissions
  onSubmit: (data: { name: string; permissions: Permission[] }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: UserFormProps) {
  const { t } = useTranslation('settings')
  const [name, setName] = useState(user?.name ?? '')
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
    onSubmit({ name: name.trim(), permissions })
  }

  const isEditing = !!user

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="user-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
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
          {t('sections.users.permissions')}
        </label>
        <UserPermissions
          permissions={permissions}
          onChange={setPermissions}
          disabled={isLoading}
          selectedRole={selectedRole}
          onRoleChange={setSelectedRole}
        />
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
          {t('sections.users.modals.cancel')}
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
