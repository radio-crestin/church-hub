import type { RoutePermission } from '../middleware/route-permissions'

const YT = '/api/livestream/youtube'
const OBS = '/api/livestream/obs'
const MIXER = '/api/livestream/mixer'

/**
 * Who may use each Live Stream route. The page shows to `settings.view`;
 * reading needs that, changing its setup (accounts, OBS, scenes, mixer)
 * `settings.edit`, and starting or stopping what goes out (the stream, a
 * broadcast, a scene, the OBS connection) `control_room.control`.
 */
export const LIVESTREAM_PERMISSIONS: RoutePermission[] = [
  { method: 'POST', path: `${YT}/sign-in`, permission: 'settings.edit' },
  { method: 'POST', path: `${YT}/tokens`, permission: 'settings.edit' },
  { method: 'GET', path: `${YT}/status`, permission: 'settings.view' },
  { method: 'DELETE', path: `${YT}/logout`, permission: 'settings.edit' },
  {
    method: 'POST',
    path: `${YT}/broadcast`,
    permission: 'control_room.control',
  },
  {
    method: 'GET',
    path: `${YT}/broadcast/active`,
    permission: 'settings.view',
  },
  {
    method: 'PUT',
    path: /^\/api\/livestream\/youtube\/broadcast\/[^/]+\/end$/,
    permission: 'control_room.control',
  },
  { method: 'GET', path: `${YT}/streams`, permission: 'settings.view' },
  {
    method: 'GET',
    path: `${YT}/broadcasts/upcoming`,
    permission: 'settings.view',
  },
  {
    method: 'GET',
    path: `${YT}/broadcasts/completed`,
    permission: 'settings.view',
  },
  { method: 'GET', path: `${YT}/playlists`, permission: 'settings.view' },
  { method: 'GET', path: `${YT}/categories`, permission: 'settings.view' },
  {
    method: 'GET',
    path: /^\/api\/livestream\/youtube\/broadcasts\/[^/]+\/template$/,
    permission: 'settings.view',
  },
  { method: 'GET', path: `${YT}/config`, permission: 'settings.view' },
  { method: 'PUT', path: `${YT}/config`, permission: 'settings.edit' },

  { method: 'GET', path: `${OBS}/status`, permission: 'settings.view' },
  {
    method: 'POST',
    path: `${OBS}/connect`,
    permission: 'control_room.control',
  },
  {
    method: 'POST',
    path: `${OBS}/disconnect`,
    permission: 'control_room.control',
  },
  { method: 'GET', path: `${OBS}/scenes`, permission: 'settings.view' },
  { method: 'POST', path: `${OBS}/scenes/sync`, permission: 'settings.edit' },
  { method: 'POST', path: `${OBS}/scenes`, permission: 'settings.edit' },
  {
    method: 'DELETE',
    path: /^\/api\/livestream\/obs\/scenes\/\d+$/,
    permission: 'settings.edit',
  },
  {
    method: 'PUT',
    path: /^\/api\/livestream\/obs\/scenes\/\d+$/,
    permission: 'settings.edit',
  },
  { method: 'PUT', path: `${OBS}/scenes/reorder`, permission: 'settings.edit' },
  { method: 'GET', path: `${OBS}/shortcuts`, permission: 'settings.view' },
  {
    method: 'GET',
    path: `${OBS}/scene-automation`,
    permission: 'settings.view',
  },
  {
    method: 'PUT',
    path: `${OBS}/scene-automation`,
    permission: 'settings.edit',
  },
  {
    method: 'POST',
    path: /^\/api\/livestream\/obs\/scene\/.+$/,
    permission: 'control_room.control',
  },
  {
    method: 'POST',
    path: `${OBS}/stream/start`,
    permission: 'control_room.control',
  },
  {
    method: 'POST',
    path: `${OBS}/stream/stop`,
    permission: 'control_room.control',
  },
  { method: 'GET', path: `${OBS}/config`, permission: 'settings.view' },
  { method: 'PUT', path: `${OBS}/config`, permission: 'settings.edit' },

  { method: 'GET', path: `${MIXER}/config`, permission: 'settings.view' },
  { method: 'PUT', path: `${MIXER}/config`, permission: 'settings.edit' },
  { method: 'GET', path: `${MIXER}/channels`, permission: 'settings.view' },
  { method: 'PUT', path: `${MIXER}/channels`, permission: 'settings.edit' },
  { method: 'POST', path: `${MIXER}/test`, permission: 'settings.edit' },

  {
    method: 'GET',
    path: '/api/livestream/message',
    permission: 'settings.view',
  },
]
