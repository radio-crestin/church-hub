import { type CloudIdentity, updateCloudIdentity } from './cloudIdentityStore'
import { serviceError, syncServiceRequest } from './syncServiceRequest'
import { getRawDatabase } from '../../../db'

interface Grant {
  owner_id: number
  permission: string
}

function permissionsOf(grants: Grant[], ownerId: number): string[] {
  return grants
    .filter((grant) => grant.owner_id === ownerId)
    .map((grant) => grant.permission)
    .sort()
}

/**
 * This server's roles and users, as the service checks writes against, and
 * the rule that a deactivated or removed user's devices are revoked.
 */
function readAccess() {
  const db = getRawDatabase()
  const roleGrants = db
    .query<Grant, []>(
      'SELECT role_id AS owner_id, permission FROM role_permissions',
    )
    .all()
  const userGrants = db
    .query<Grant, []>(
      'SELECT user_id AS owner_id, permission FROM user_permissions',
    )
    .all()
  const roles = db
    .query<{ id: number; name: string }, []>(
      'SELECT id, name FROM roles ORDER BY id',
    )
    .all()
    .map((role) => ({
      id: String(role.id),
      name: role.name,
      permissions: permissionsOf(roleGrants, role.id),
    }))
  const users = db
    .query<
      {
        id: number
        name: string
        role_id: number | null
        is_super_admin: number
        is_active: number
      },
      []
    >(
      'SELECT id, name, role_id, is_super_admin, is_active FROM users ORDER BY id',
    )
    .all()
    .map((user) => ({
      id: String(user.id),
      name: user.name,
      roleId: user.role_id === null ? null : String(user.role_id),
      isSuperAdmin: user.is_super_admin === 1,
      isActive: user.is_active === 1,
      permissions: permissionsOf(userGrants, user.id),
    }))
  return { roles, users, revokeDevicesWithUser: true }
}

/** What the service did with a pushed access. */
export interface AccessPush {
  /** False from an older service, which leaves the devices to revoke. */
  revokesDevicesWithUser: boolean
}

/**
 * Mirrors this server's roles and users to the service, the authority every
 * phone's write is checked against, whenever they changed since last time.
 * The service revokes the devices of users deactivated or removed and moves
 * the read path, which this server keeps at once. Null: nothing changed.
 */
export async function pushAccessIfChanged(
  identity: CloudIdentity,
): Promise<AccessPush | null> {
  const access = readAccess()
  const hash = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(access))
    .digest('hex')
  if (hash === identity.accessHash) return null

  const response = await syncServiceRequest<{
    revokedDevices?: number
    readUrl?: string
  }>({ serviceUrl: identity.serviceUrl, identity }, 'PUT', '/access', access)
  if (response.status !== 200) throw serviceError(response)
  const { revokedDevices, readUrl } = response.body
  const moved = readUrl !== undefined && readUrl !== identity.readUrl
  await updateCloudIdentity({
    accessHash: hash,
    ...(moved && { readUrl, headEtag: null }),
  })
  identity.accessHash = hash
  if (moved) {
    identity.readUrl = readUrl
    identity.headEtag = null
  }
  return { revokesDevicesWithUser: revokedDevices !== undefined }
}
