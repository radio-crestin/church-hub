import type { RoutePermission } from '../middleware/route-permissions'

const LT = '/api/live-translation'

/**
 * Who may use each Live Translation route. The page shows to
 * `settings.view`, which reads it; starting, stopping or clearing what
 * listeners hear needs `control_room.control`; its settings and a new
 * listener link need `settings.edit`.
 */
export const LIVE_TRANSLATION_PERMISSIONS: RoutePermission[] = [
  { method: 'GET', path: `${LT}/state`, permission: 'settings.view' },
  { method: 'POST', path: `${LT}/start`, permission: 'control_room.control' },
  { method: 'POST', path: `${LT}/stop`, permission: 'control_room.control' },
  { method: 'POST', path: `${LT}/clear`, permission: 'control_room.control' },
  { method: 'GET', path: `${LT}/devices`, permission: 'settings.view' },
  { method: 'GET', path: `${LT}/settings`, permission: 'settings.view' },
  { method: 'PUT', path: `${LT}/settings`, permission: 'settings.edit' },
  { method: 'GET', path: `${LT}/stream-secret`, permission: 'settings.view' },
  {
    method: 'DELETE',
    path: `${LT}/link-changed`,
    permission: 'settings.view',
  },
  {
    method: 'POST',
    path: `${LT}/stream-secret/reset`,
    permission: 'settings.edit',
  },
  { method: 'GET', path: `${LT}/stream-info`, permission: 'settings.view' },
]
