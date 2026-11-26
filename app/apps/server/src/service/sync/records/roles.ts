import { adoptByName } from './adoptByName'
import { idByUuid } from './idByUuid'
import { readPermissions, writePermissions } from './permissions'
import { getRawDatabase } from '../../../db'
import type { LibraryRole } from '../types'

export function serializeRoles(): LibraryRole[] {
  const permissions = readPermissions('role_permissions', 'role_id')
  return getRawDatabase()
    .query<
      {
        id: number
        uuid: string
        name: string
        is_system: number
        created_at: number
        updated_at: number
      },
      []
    >(
      `SELECT id, uuid, name, is_system, created_at, updated_at
         FROM roles WHERE uuid != ''`,
    )
    .all()
    .map((row) => ({
      uuid: row.uuid,
      name: row.name,
      isSystem: row.is_system,
      permissions: permissions.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
}

/** The system roles every install seeds are matched by name. */
export function upsertRole(role: LibraryRole): number | null {
  adoptByName('roles', role.uuid, role.name)
  getRawDatabase()
    .query(
      `INSERT INTO roles (uuid, name, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (uuid) DO UPDATE SET
         name = excluded.name, is_system = excluded.is_system,
         updated_at = excluded.updated_at`,
    )
    .run(role.uuid, role.name, role.isSystem, role.createdAt, role.updatedAt)
  const roleId = idByUuid('roles', role.uuid)
  if (roleId !== null) {
    writePermissions('role_permissions', 'role_id', roleId, role.permissions)
  }
  return roleId
}
