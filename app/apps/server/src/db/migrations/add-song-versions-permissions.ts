import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-song-versions-permissions:${level}] ${message}`)
}

/**
 * Backfills the four new `song_versions.*` permissions for users and roles
 * that already had the equivalent `songs.*` rights. Without this migration,
 * existing operators would silently lose access to the versions panel /
 * mutate buttons when the gate moves to dedicated perms.
 *
 * Mapping:
 *  - `songs.view`   → `song_versions.view`
 *  - `songs.create` → `song_versions.create`
 *  - `songs.edit`   → `song_versions.create + song_versions.edit + song_versions.delete`
 *                     (edit historically implied all version writes)
 *  - `songs.delete` → `song_versions.delete`
 *
 * Idempotent: `INSERT OR IGNORE` against the unique
 * `(user_id, permission)` / `(role_id, permission)` constraints, so it's
 * safe to re-run on every boot.
 */
export function addSongVersionsPermissions(db: Database): void {
  // The mapping is applied for both roles and users so the seeded role
  // templates AND any per-user overrides stay coherent.
  const writeMappings: Array<{ from: string; grants: string[] }> = [
    { from: 'songs.view', grants: ['song_versions.view'] },
    { from: 'songs.create', grants: ['song_versions.create'] },
    {
      from: 'songs.edit',
      grants: [
        'song_versions.create',
        'song_versions.edit',
        'song_versions.delete',
      ],
    },
    { from: 'songs.delete', grants: ['song_versions.delete'] },
  ]

  let userInserts = 0
  let roleInserts = 0

  for (const { from, grants } of writeMappings) {
    for (const grant of grants) {
      // Role-level backfill: any role that already has `from` gets `grant`.
      const roleResult = db.run(
        `INSERT OR IGNORE INTO role_permissions (role_id, permission)
         SELECT DISTINCT role_id, ?
         FROM role_permissions
         WHERE permission = ?`,
        [grant, from],
      )
      roleInserts += roleResult.changes

      // User-level backfill: any user with an explicit `from` override gets
      // the equivalent `grant`. Doesn't touch role-derived perms (those are
      // handled above).
      const userResult = db.run(
        `INSERT OR IGNORE INTO user_permissions (user_id, permission)
         SELECT DISTINCT user_id, ?
         FROM user_permissions
         WHERE permission = ?`,
        [grant, from],
      )
      userInserts += userResult.changes
    }
  }

  if (roleInserts === 0 && userInserts === 0) {
    log('debug', 'song_versions.* already present everywhere — nothing to do.')
    return
  }

  log(
    'info',
    `Backfilled song_versions.* — ${roleInserts} role grant(s), ${userInserts} user grant(s).`,
  )
}
