import { SyncError } from './SyncError'

export interface AccessRole {
  id: string
  name: string
  permissions: string[]
}

export interface AccessUser {
  id: string
  name: string
  roleId: string | null
  isSuperAdmin: boolean
  isActive: boolean
  permissions: string[]
}

export interface Access {
  roles: AccessRole[]
  users: AccessUser[]
  /** The server's signal: a deactivated or removed user's devices are revoked. */
  revokeDevicesWithUser: boolean
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const PERMISSION_PATTERN = /^[a-z_]+\.[a-z_]+$/
const MAX_ROLES = 100
const MAX_USERS = 500

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_request', message)
}

function parseCommon(raw: unknown, where: string) {
  const item = (raw ?? {}) as Record<string, unknown>
  if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
    invalid(`${where}.id is invalid`)
  }
  if (typeof item.name !== 'string' || item.name.length > 200) {
    invalid(`${where}.name must be a string`)
  }
  const permissions = item.permissions ?? []
  if (
    !Array.isArray(permissions) ||
    !permissions.every(
      (p) => typeof p === 'string' && PERMISSION_PATTERN.test(p)
    )
  ) {
    invalid(`${where}.permissions must be permission keys`)
  }
  return {
    item,
    common: {
      id: item.id,
      name: item.name,
      permissions: [...new Set(permissions as string[])].sort(),
    },
  }
}

/** Validates `PUT access`: the church's roles and users, as the PC has them. */
export function parseAccess(body: unknown): Access {
  const { roles, users, revokeDevicesWithUser } = (body ?? {}) as Record<
    string,
    unknown
  >
  if (!Array.isArray(roles) || roles.length > MAX_ROLES) {
    invalid(`roles must be an array of at most ${MAX_ROLES}`)
  }
  if (!Array.isArray(users) || users.length > MAX_USERS) {
    invalid(`users must be an array of at most ${MAX_USERS}`)
  }
  return {
    roles: roles.map(
      (raw, index) => parseCommon(raw, `roles[${index}]`).common
    ),
    users: users.map((raw, index) => {
      const { item, common } = parseCommon(raw, `users[${index}]`)
      if (item.roleId != null && typeof item.roleId !== 'string') {
        invalid(`users[${index}].roleId must be a string or null`)
      }
      return {
        ...common,
        roleId: (item.roleId as string | null) ?? null,
        isSuperAdmin: item.isSuperAdmin === true,
        isActive: item.isActive !== false,
      }
    }),
    revokeDevicesWithUser: revokeDevicesWithUser === true,
  }
}
