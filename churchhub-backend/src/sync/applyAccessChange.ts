import type { RoleRecord, UserRecord } from './state/ChurchState'
import type { ChangeInput } from './types'

/** The church's roles and users, as writes are checked against them. */
export interface Access {
  roles: RoleRecord[]
  users: UserRecord[]
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === 'string'))]
    : []

/**
 * Applies a `role` or `user` change (the app's LibraryRole / LibraryUser)
 * to `access`, in place: the rules every later change is checked against.
 * Other changes leave it as it is.
 */
export function applyAccessChange(access: Access, change: ChangeInput): void {
  if (change.type !== 'role' && change.type !== 'user') return
  const list: { id: string }[] =
    change.type === 'role' ? access.roles : access.users
  const index = list.findIndex((row) => row.id === change.uuid)
  if (index >= 0) list.splice(index, 1)
  if (change.op === 'delete' || !change.data) return

  const data = change.data
  const common = {
    id: change.uuid,
    name: String(data.name ?? ''),
    permissions: strings(data.permissions).sort(),
  }
  if (change.type === 'role') {
    access.roles.push(common)
  } else {
    access.users.push({
      ...common,
      roleId: typeof data.roleUuid === 'string' ? data.roleUuid : null,
      isSuperAdmin: Boolean(data.isSuperAdmin),
      isActive: Boolean(data.isActive),
    })
  }
}
