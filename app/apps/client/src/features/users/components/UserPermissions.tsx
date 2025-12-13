import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Permission, PermissionGroup, RoleTemplate } from '../types'
import { PERMISSION_GROUPS, ROLE_TEMPLATES } from '../types'

interface UserPermissionsProps {
  permissions: Permission[]
  onChange: (permissions: Permission[]) => void
  disabled?: boolean
  selectedRole?: RoleTemplate | null
  onRoleChange?: (role: RoleTemplate | null) => void
}

const GROUP_ORDER: PermissionGroup[] = [
  'songs',
  'control_room',
  'programs',
  'queue',
  'settings',
  'displays',
  'users',
]

export function UserPermissions({
  permissions,
  onChange,
  disabled,
  selectedRole,
  onRoleChange,
}: UserPermissionsProps) {
  const { t } = useTranslation('settings')
  const [expandedGroups, setExpandedGroups] = useState<Set<PermissionGroup>>(
    new Set(['songs', 'control_room']),
  )

  const toggleGroup = (group: PermissionGroup) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(group)) {
      newExpanded.delete(group)
    } else {
      newExpanded.add(group)
    }
    setExpandedGroups(newExpanded)
  }

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    if (checked) {
      onChange([...permissions, permission])
    } else {
      onChange(permissions.filter((p) => p !== permission))
    }
    // If permissions are manually changed, clear the role selection
    if (onRoleChange) {
      onRoleChange(null)
    }
  }

  const handleGroupToggle = (group: PermissionGroup, checked: boolean) => {
    const groupPerms = PERMISSION_GROUPS[group]
    if (checked) {
      // Add all permissions from this group
      const newPerms = new Set([...permissions, ...groupPerms])
      onChange(Array.from(newPerms))
    } else {
      // Remove all permissions from this group
      onChange(permissions.filter((p) => !groupPerms.includes(p)))
    }
    // If permissions are manually changed, clear the role selection
    if (onRoleChange) {
      onRoleChange(null)
    }
  }

  const handleRoleSelect = (role: RoleTemplate | null) => {
    if (onRoleChange) {
      onRoleChange(role)
    }
    if (role) {
      onChange([...ROLE_TEMPLATES[role]])
    }
  }

  const isGroupFullySelected = (group: PermissionGroup) => {
    return PERMISSION_GROUPS[group].every((p) => permissions.includes(p))
  }

  const isGroupPartiallySelected = (group: PermissionGroup) => {
    const groupPerms = PERMISSION_GROUPS[group]
    const selectedCount = groupPerms.filter((p) =>
      permissions.includes(p),
    ).length
    return selectedCount > 0 && selectedCount < groupPerms.length
  }

  const getGroupSelectedCount = (group: PermissionGroup) => {
    return PERMISSION_GROUPS[group].filter((p) => permissions.includes(p))
      .length
  }

  return (
    <div className="space-y-4">
      {/* Role Template Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('sections.users.roleTemplate')}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ROLE_TEMPLATES) as RoleTemplate[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSelect(role)}
              disabled={disabled}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                selectedRole === role
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t(`sections.users.roles.${role}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Permission Groups */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {GROUP_ORDER.map((group) => {
          const isExpanded = expandedGroups.has(group)
          const isFullySelected = isGroupFullySelected(group)
          const isPartiallySelected = isGroupPartiallySelected(group)
          const selectedCount = getGroupSelectedCount(group)
          const totalCount = PERMISSION_GROUPS[group].length

          return (
            <div
              key={group}
              className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              {/* Group Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-500" />
                  )}
                </button>
                <input
                  type="checkbox"
                  checked={isFullySelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartiallySelected
                  }}
                  onChange={(e) => handleGroupToggle(group, e.target.checked)}
                  disabled={disabled}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300
                    focus:ring-indigo-500 disabled:opacity-50 cursor-pointer
                    disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex-1 text-left text-sm font-medium text-gray-900 dark:text-white"
                >
                  {t(`sections.users.groups.${group}`)}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedCount}/{totalCount}
                </span>
              </div>

              {/* Group Permissions */}
              {isExpanded && (
                <div className="px-3 py-2 space-y-2 bg-white dark:bg-gray-800">
                  {PERMISSION_GROUPS[group].map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.includes(permission)}
                        onChange={(e) =>
                          handlePermissionChange(permission, e.target.checked)
                        }
                        disabled={disabled}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300
                          focus:ring-indigo-500 disabled:opacity-50 cursor-pointer
                          disabled:cursor-not-allowed ml-6"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {t(`sections.users.permissionLabels.${permission}`)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected Count */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-right">
        {permissions.length} {t('sections.users.permissionsSelected')}
      </p>
    </div>
  )
}
