import type { RoutePermission } from '../middleware/route-permissions'

/**
 * Who may use each MIDI route. Reading the devices needs `settings.view`.
 * Connecting the controller is what the app does at start for whoever runs
 * it with a saved device, presenters included: `control_room.control` or
 * `settings.edit` (the MIDI settings).
 */
export const MIDI_PERMISSIONS: RoutePermission[] = [
  { method: 'GET', path: '/api/midi/devices', permission: 'settings.view' },
  { method: 'GET', path: '/api/midi/status', permission: 'settings.view' },
  {
    method: 'GET',
    path: '/api/midi/debug-shortcuts',
    permission: 'settings.view',
  },
  {
    method: 'POST',
    path: '/api/midi/connect',
    permission: ['control_room.control', 'settings.edit'],
  },
  {
    method: 'POST',
    path: '/api/midi/disconnect',
    permission: ['control_room.control', 'settings.edit'],
  },
]
