import type { RoutePermission } from '../middleware/route-permissions'

const CLOUD = '/api/backup/cloud'

/**
 * Who may use each Church Hub Cloud backup route (all only from this
 * machine). Reading needs `settings.view`; backing up, its schedule,
 * deleting and confirming a step `settings.edit`; signing in (which picks
 * the account the database goes to) and restoring (which replaces it) a
 * super admin. The sign-in's return is bound to its own nonce and verifier.
 */
export const CLOUD_BACKUP_PERMISSIONS: RoutePermission[] = [
  { method: 'GET', path: `${CLOUD}/status`, permission: 'settings.view' },
  { method: 'POST', path: `${CLOUD}/sign-in`, permission: 'admin' },
  { method: 'GET', path: `${CLOUD}/callback`, permission: 'none' },
  {
    method: 'POST',
    path: `${CLOUD}/confirmations`,
    permission: 'settings.edit',
  },
  { method: 'POST', path: `${CLOUD}/sign-out`, permission: 'settings.edit' },
  { method: 'PUT', path: `${CLOUD}/config`, permission: 'settings.edit' },
  { method: 'GET', path: `${CLOUD}/backups`, permission: 'settings.view' },
  { method: 'POST', path: `${CLOUD}/backups`, permission: 'settings.edit' },
  {
    method: 'POST',
    path: /^\/api\/backup\/cloud\/backups\/[^/]+\/restore$/,
    permission: 'admin',
  },
  {
    method: 'DELETE',
    path: /^\/api\/backup\/cloud\/backups\/[^/]+$/,
    permission: 'settings.edit',
  },
]
