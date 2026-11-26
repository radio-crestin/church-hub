import type { RoutePermission } from '../middleware/route-permissions'

/**
 * Who may use each Music route. The page shows to `settings.view`, which
 * reads the library and plays it; changing the library (folders, playlists)
 * needs `settings.edit`.
 */
export const MUSIC_PERMISSIONS: RoutePermission[] = [
  {
    method: 'GET',
    path: '/api/music/player/status',
    permission: 'settings.view',
  },
  { method: 'GET', path: '/api/music/folders', permission: 'settings.view' },
  { method: 'POST', path: '/api/music/folders', permission: 'settings.edit' },
  {
    method: 'DELETE',
    path: /^\/api\/music\/folders\/\d+$/,
    permission: 'settings.edit',
  },
  {
    method: 'PUT',
    path: /^\/api\/music\/folders\/\d+$/,
    permission: 'settings.edit',
  },
  {
    method: 'POST',
    path: /^\/api\/music\/folders\/\d+\/sync$/,
    permission: 'settings.edit',
  },
  { method: 'GET', path: '/api/music/files', permission: 'settings.view' },
  {
    method: 'GET',
    path: /^\/api\/music\/files\/\d+$/,
    permission: 'settings.view',
  },
  { method: 'GET', path: '/api/music/playlists', permission: 'settings.view' },
  { method: 'POST', path: '/api/music/playlists', permission: 'settings.edit' },
  {
    method: 'GET',
    path: /^\/api\/music\/playlists\/\d+$/,
    permission: 'settings.view',
  },
  {
    method: 'DELETE',
    path: /^\/api\/music\/playlists\/\d+$/,
    permission: 'settings.edit',
  },
  {
    method: 'POST',
    path: /^\/api\/music\/playlists\/\d+\/items$/,
    permission: 'settings.edit',
  },
  {
    method: 'DELETE',
    path: /^\/api\/music\/playlists\/\d+\/items\/\d+$/,
    permission: 'settings.edit',
  },
  {
    method: 'PUT',
    path: /^\/api\/music\/playlists\/\d+\/items\/reorder$/,
    permission: 'settings.edit',
  },
]
