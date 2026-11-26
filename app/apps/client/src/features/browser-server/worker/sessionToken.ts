import { getRawDatabase } from '../../../../../server/src/db'

/**
 * The session token this browser signs in with (sent as X-User-Auth): its
 * device's user in a church, the first super admin as a guest. Every user
 * has a login token of its own on each database (a synced one too).
 */
export function sessionToken(userUuid: string | null): string {
  const db = getRawDatabase()
  const row = (
    userUuid
      ? db
          .query('SELECT token FROM users WHERE uuid = ? AND is_active = 1')
          .get(userUuid)
      : db
          .query(
            'SELECT token FROM users WHERE is_super_admin = 1 AND is_active = 1 ORDER BY id LIMIT 1',
          )
          .get()
  ) as { token: string | null } | null
  if (!row?.token) {
    throw new Error(
      userUuid
        ? `This device's user (${userUuid}) is not in the church, or not active`
        : 'The guest database has no administrator',
    )
  }
  return row.token
}
