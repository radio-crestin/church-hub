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

/** This server's roles and users, as the service checks writes against. */
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
  return { roles, users }
}

/**
 * Mirrors this server's roles and users to the service, the authority every
 * phone's write is checked against, whenever they changed since last time.
 */
export async function pushAccessIfChanged(
  identity: CloudIdentity,
): Promise<void> {
  const access = readAccess()
  const hash = new Bun.CryptoHasher('sha256')
    .update(JSON.stringify(access))
    .digest('hex')
  if (hash === identity.accessHash) return

  const response = await syncServiceRequest(
    { serviceUrl: identity.serviceUrl, identity },
    'PUT',
    '/access',
    access,
  )
  if (response.status !== 200) throw serviceError(response)
  await updateCloudIdentity({ accessHash: hash })
  identity.accessHash = hash
}
