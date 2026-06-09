import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: migration logging
  console.log(`[add-logs-permissions:${level}] ${message}`)
}

/**
 * Backfills the new `logs.view` permission for roles and users that already
 * have `settings.edit`. Before this feature, the logs folder was reachable
 * from the (settings.edit-gated) Developer settings, so settings editors could
 * already see logs — this keeps that access when the dedicated Logs section
 * moves behind `logs.view`.
 *
 * `logs.clear` is intentionally NOT backfilled: clearing logs is a new,
 * destructive capability that an admin grants explicitly.
 *
 * Idempotent: `INSERT OR IGNORE` against the unique
 * `(user_id, permission)` / `(role_id, permission)` constraints, so it's safe
 * to re-run on every boot.
 */
export function addLogsPermissions(db: Database): void {
  // Role-level backfill: any role that already has `settings.edit` gets
  // `logs.view`.
  const roleResult = db.run(
    `INSERT OR IGNORE INTO role_permissions (role_id, permission)
     SELECT DISTINCT role_id, 'logs.view'
     FROM role_permissions
     WHERE permission = 'settings.edit'`,
  )

  // User-level backfill: any user with an explicit `settings.edit` override
  // gets `logs.view`. Role-derived perms are handled above.
  const userResult = db.run(
    `INSERT OR IGNORE INTO user_permissions (user_id, permission)
     SELECT DISTINCT user_id, 'logs.view'
     FROM user_permissions
     WHERE permission = 'settings.edit'`,
  )

  if (roleResult.changes === 0 && userResult.changes === 0) {
    log('debug', 'logs.view already present everywhere — nothing to do.')
    return
  }

  log(
    'info',
    `Backfilled logs.view — ${roleResult.changes} role grant(s), ${userResult.changes} user grant(s).`,
  )
}
