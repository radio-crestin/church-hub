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
  // "Versiuni ale cântării" — slots right under Songs since it shares
  // their context (same panel column on the song detail page).
  'song_versions',
  'bible',
  'control_room',
  'programs',
  'queue',
  'song_key',
  'settings',
  'logs',
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
    <div className="space-y-5">
      {/* Role Template Selection */}
      <div>
        <h4 className="text-sm font-semibold text-fg">
          {t('sections.users.roleTemplate')}
        </h4>
        <p className="mb-2.5 text-xs text-fg-hint">
          {t('sections.users.roleTemplateHint')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ROLE_TEMPLATES) as RoleTemplate[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => handleRoleSelect(role)}
              disabled={disabled}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                selectedRole === role
                  ? 'border-transparent bg-selected text-fg'
                  : 'border-transparent bg-field text-fg-body hover:bg-hover'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {t(`sections.users.roles.${role}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Permission Groups */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-fg">
            {t('sections.users.permissions')}
          </h4>
          <span className="text-xs text-fg-hint">
            {t('sections.users.permissionsSelectedCount', {
              count: permissions.length,
            })}
          </span>
        </div>
        <div className="border border-line rounded-lg overflow-hidden">
          {GROUP_ORDER.map((group) => {
            const isExpanded = expandedGroups.has(group)
            const isFullySelected = isGroupFullySelected(group)
            const isPartiallySelected = isGroupPartiallySelected(group)
            const selectedCount = getGroupSelectedCount(group)
            const totalCount = PERMISSION_GROUPS[group].length

            return (
              <div key={group} className="border-b border-line last:border-b-0">
                {/* Group Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-field">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="p-0.5 hover:bg-hover rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown
                        strokeWidth={1.5}
                        size={16}
                        className="text-fg-hint"
                      />
                    ) : (
                      <ChevronRight
                        strokeWidth={1.5}
                        size={16}
                        className="text-fg-hint"
                      />
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
                    className="w-4 h-4 accent-primary text-primary rounded border-line
                    focus:ring-focus disabled:opacity-50 cursor-pointer
                    disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="flex-1 text-left text-sm font-medium text-fg"
                  >
                    {t(`sections.users.groups.${group}`)}
                  </button>
                  <span className="text-xs text-fg-hint">
                    {selectedCount}/{totalCount}
                  </span>
                </div>

                {/* Group Permissions */}
                {isExpanded && (
                  <div className="px-3 py-2 space-y-2 bg-panel">
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
                          className="w-4 h-4 accent-primary text-primary rounded border-line
                          focus:ring-focus disabled:opacity-50 cursor-pointer
                          disabled:cursor-not-allowed ml-6"
                        />
                        <span className="text-sm text-fg-body">
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
      </div>
    </div>
  )
}
