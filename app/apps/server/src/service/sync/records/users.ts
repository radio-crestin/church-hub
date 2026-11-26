import { createHash } from 'node:crypto'

import { idByUuid } from './idByUuid'
import { readPermissions, writePermissions } from './permissions'
import { getRawDatabase } from '../../../db'
import { sealSecret, secretPlaces } from '../../secret-store'
import { generateUserToken } from '../../users/users'
import type { LibraryUser } from '../types'

/** Accounts as they sync: never a login token or password. */
export function serializeUsers(): LibraryUser[] {
  const permissions = readPermissions('user_permissions', 'user_id')
  return getRawDatabase()
    .query<
      {
        id: number
        uuid: string
        name: string
        is_active: number
        is_super_admin: number
        role_uuid: string | null
        created_at: number
        updated_at: number
      },
      []
    >(
      `SELECT u.id, u.uuid, u.name, u.is_active, u.is_super_admin,
              r.uuid AS role_uuid, u.created_at, u.updated_at
         FROM users u LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.uuid != ''`,
    )
    .all()
    .map((row) => ({
      uuid: row.uuid,
      name: row.name,
      isActive: row.is_active,
      isSuperAdmin: row.is_super_admin,
      roleUuid: row.role_uuid,
      permissions: permissions.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
}

/**
 * An account made elsewhere gets a login token of its own here (tokens and
 * passwords never travel), sealed like every stored token; an existing one
 * keeps its own.
 */
export function upsertUser(user: LibraryUser): number | null {
  const db = getRawDatabase()
  const roleId = user.roleUuid ? idByUuid('roles', user.roleUuid) : null
  const token = generateUserToken()
  const tokenHash = createHash('sha256').update(token).digest('hex')
  db.query(
    `INSERT INTO users (
       uuid, name, token, token_hash, is_active, is_super_admin, role_id,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (uuid) DO UPDATE SET
       name = excluded.name, is_active = excluded.is_active,
       is_super_admin = excluded.is_super_admin, role_id = excluded.role_id,
       updated_at = excluded.updated_at`,
  ).run(
    user.uuid,
    user.name,
    sealSecret(token, secretPlaces.userToken(tokenHash)),
    tokenHash,
    user.isActive,
    user.isSuperAdmin,
    roleId,
    user.createdAt,
    user.updatedAt,
  )
  const userId = idByUuid('users', user.uuid)
  if (userId !== null) {
    writePermissions('user_permissions', 'user_id', userId, user.permissions)
  }
  return userId
}
