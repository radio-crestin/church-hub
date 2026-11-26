import { type APIRequestContext, expect, test } from '@playwright/test'

import { lanBaseUrl } from './helpers/lan-address'
import { rawRequest } from './helpers/raw-request'

/**
 * Every route checks its permission. For each route group: without a session
 * (a device on the network) it answers 401; a user without the permission,
 * 403; this machine's windows without a session (projector screens: *.view
 * only) can read but not change anything. A user with just the permission
 * gets through, on routes that are safe to call on a test server; routes
 * marked `admin` need a super admin.
 *
 * The default `request` fixture is the super admin (auth.setup.ts).
 */

type Need = string | string[] | 'admin'

interface RouteCase {
  method: string
  path: string
  need: Need
  body?: unknown
  /** Calling it as permitted changes nothing that matters on a test server. */
  safe?: boolean
}

const LIVESTREAM: RouteCase[] = [
  {
    method: 'GET',
    path: '/api/livestream/youtube/status',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/livestream/youtube/config',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'PUT',
    path: '/api/livestream/youtube/config',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/livestream/youtube/sign-in',
    need: 'settings.edit',
    safe: true,
  },
  {
    method: 'POST',
    path: '/api/livestream/youtube/tokens',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'DELETE',
    path: '/api/livestream/youtube/logout',
    need: 'settings.edit',
  },
  {
    method: 'POST',
    path: '/api/livestream/youtube/broadcast',
    need: 'control_room.control',
    body: {},
  },
  {
    method: 'PUT',
    path: '/api/livestream/youtube/broadcast/x/end',
    need: 'control_room.control',
  },
  {
    method: 'GET',
    path: '/api/livestream/obs/status',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/livestream/obs/scenes',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/connect',
    need: 'control_room.control',
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/disconnect',
    need: 'control_room.control',
    safe: true,
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/scene/Main',
    need: 'control_room.control',
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/stream/start',
    need: 'control_room.control',
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/stream/stop',
    need: 'control_room.control',
  },
  {
    method: 'PUT',
    path: '/api/livestream/obs/config',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/livestream/obs/scenes',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'PUT',
    path: '/api/livestream/obs/scene-automation',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'GET',
    path: '/api/livestream/mixer/config',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'PUT',
    path: '/api/livestream/mixer/channels',
    need: 'settings.edit',
    body: {},
  },
  { method: 'POST', path: '/api/livestream/mixer/test', need: 'settings.edit' },
]

const LIVE_TRANSLATION: RouteCase[] = [
  {
    method: 'GET',
    path: '/api/live-translation/state',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/live-translation/settings',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/live-translation/stream-info',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'POST',
    path: '/api/live-translation/start',
    need: 'control_room.control',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/live-translation/stop',
    need: 'control_room.control',
  },
  {
    method: 'POST',
    path: '/api/live-translation/clear',
    need: 'control_room.control',
    safe: true,
  },
  {
    method: 'PUT',
    path: '/api/live-translation/settings',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/live-translation/stream-secret/reset',
    need: 'settings.edit',
    safe: true,
  },
]

const MUSIC: RouteCase[] = [
  {
    method: 'GET',
    path: '/api/music/folders',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/music/playlists',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/music/player/status',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'POST',
    path: '/api/music/folders',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/music/playlists',
    need: 'settings.edit',
    body: {},
  },
  {
    method: 'DELETE',
    path: '/api/music/playlists/999999',
    need: 'settings.edit',
    safe: true,
  },
]

const MIDI: RouteCase[] = [
  {
    method: 'GET',
    path: '/api/midi/status',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/midi/devices',
    need: 'settings.view',
    safe: true,
  },
  // Connecting the controller: presenters do it at start, so either works.
  {
    method: 'POST',
    path: '/api/midi/disconnect',
    need: ['control_room.control', 'settings.edit'],
    safe: true,
  },
]

/** This computer's own data: only from this machine, and with permission. */
const LOCAL_DATA: RouteCase[] = [
  {
    method: 'GET',
    path: '/api/backup/status',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/backup/config',
    need: 'settings.view',
    safe: true,
  },
  {
    method: 'PUT',
    path: '/api/backup/config',
    need: 'settings.edit',
    body: {},
  },
  { method: 'POST', path: '/api/backup/local/now', need: 'settings.edit' },
  { method: 'POST', path: '/api/backup/restore', need: 'admin', body: {} },
  {
    method: 'POST',
    path: '/api/backup/local/restore',
    need: 'admin',
    body: {},
  },
  {
    method: 'GET',
    path: '/api/backup/google/connect',
    need: 'admin',
    safe: true,
  },
  {
    method: 'GET',
    path: '/api/sync/status',
    need: 'settings.view',
    safe: true,
  },
  { method: 'PUT', path: '/api/sync/config', need: 'settings.edit', body: {} },
  {
    method: 'GET',
    path: '/api/database/info',
    need: 'settings.view',
    safe: true,
  },
  { method: 'POST', path: '/api/database/export', need: 'admin' },
  { method: 'POST', path: '/api/database/import', need: 'admin' },
  { method: 'POST', path: '/api/database/factory-reset', need: 'admin' },
  {
    method: 'POST',
    path: '/api/database/rebuild-search-indexes',
    need: 'settings.edit',
  },
  { method: 'GET', path: '/api/system-token', need: 'admin', safe: true },
  { method: 'POST', path: '/api/system-token/regenerate', need: 'admin' },
  { method: 'POST', path: '/api/logs/open', need: 'logs.view' },
  { method: 'POST', path: '/api/sync/cloud', need: 'users.edit', body: {} },
  { method: 'DELETE', path: '/api/sync/cloud', need: 'users.edit' },
  { method: 'GET', path: '/api/sync/cloud/owner/churches', need: 'users.edit' },
]

const FEEDBACK: RouteCase[] = [
  {
    method: 'POST',
    path: '/api/feature-requests',
    need: 'settings.view',
    body: {},
  },
  {
    method: 'POST',
    path: '/api/feedback/attach-logs',
    need: 'settings.view',
    body: {},
  },
]

const GROUPS: Record<string, RouteCase[]> = {
  'Live Stream': LIVESTREAM,
  'Live Translation': LIVE_TRANSLATION,
  Music: MUSIC,
  MIDI,
  "This computer's data (backups, sync, database, logs, cloud)": LOCAL_DATA,
  Feedback: FEEDBACK,
}

/** A permission none of the routes above needs. */
const UNRELATED = 'songs.view'

const tokens = new Map<string, string>()
const createdUsers: number[] = []

/** A signed-in user holding exactly these permissions (one per set). */
async function tokenFor(
  request: APIRequestContext,
  permissions: string[],
): Promise<string> {
  const key = permissions.join(',')
  const known = tokens.get(key)
  if (known) return known
  const res = await request.post('/api/users', {
    data: { name: `E2E route permissions ${key} ${Date.now()}`, permissions },
  })
  expect(res.ok()).toBe(true)
  const { data } = await res.json()
  createdUsers.push(data.user.id)
  tokens.set(key, data.token)
  return data.token
}

function call(
  base: string,
  route: RouteCase,
  headers: Record<string, string> = {},
) {
  const body = route.body === undefined ? undefined : JSON.stringify(route.body)
  return rawRequest(base, route.path, {
    method: route.method,
    headers: body
      ? { 'Content-Type': 'application/json', ...headers }
      : headers,
    body,
  })
}

const label = (route: RouteCase) => `${route.method} ${route.path}`
const isViewOnly = (need: Need) =>
  need !== 'admin' && [need].flat().every((p) => p.endsWith('.view'))

test.describe('Every route checks its permission', () => {
  test.afterAll(async ({ request }) => {
    for (const id of createdUsers) await request.delete(`/api/users/${id}`)
  })

  for (const [group, routes] of Object.entries(GROUPS)) {
    test(`${group}: refused without the permission`, async ({
      request,
      baseURL,
    }) => {
      const base = baseURL as string
      const unrelated = await tokenFor(request, [UNRELATED])
      for (const route of routes) {
        // A device on the network with no session.
        expect((await call(lanBaseUrl(), route)).status, label(route)).toBe(401)
        // A signed-in user without the permission.
        const lacking = await call(base, route, { 'X-User-Auth': unrelated })
        expect(lacking.status, label(route)).toBe(403)
        // This machine's windows without a session read, never change.
        if (!isViewOnly(route.need)) {
          const display = await call(base, route)
          expect(display.status, label(route)).toBe(403)
        }
      }
    })

    test(`${group}: let through with the permission`, async ({
      request,
      baseURL,
    }) => {
      const base = baseURL as string
      for (const route of routes.filter((r) => r.safe)) {
        if (route.need === 'admin') {
          const res = await request.fetch(route.path, { method: route.method })
          expect([401, 403], label(route)).not.toContain(res.status())
          continue
        }
        for (const need of [route.need].flat()) {
          const token = await tokenFor(request, [need])
          const res = await call(base, route, { 'X-User-Auth': token })
          expect([401, 403], `${label(route)} with ${need}`).not.toContain(
            res.status,
          )
        }
        if (isViewOnly(route.need)) {
          const display = await call(base, route)
          expect([401, 403], `${label(route)} from a display`).not.toContain(
            display.status,
          )
        }
      }
    })
  }

  test('a non-admin user with every permission is refused admin routes', async ({
    request,
    baseURL,
  }) => {
    const base = baseURL as string
    const everything = [
      'settings.view',
      'settings.edit',
      'users.view',
      'users.edit',
      'logs.view',
      'control_room.control',
    ]
    const token = await tokenFor(request, everything)
    for (const route of LOCAL_DATA.filter((r) => r.need === 'admin')) {
      const res = await call(base, route, { 'X-User-Auth': token })
      expect(res.status, label(route)).toBe(403)
    }
  })
})
