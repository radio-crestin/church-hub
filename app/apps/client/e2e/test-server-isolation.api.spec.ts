import { expect, test } from '@playwright/test'

import config, { SERVER_READY_LINE } from '../playwright.config'

/**
 * A local e2e run once landed on the desktop app already serving port 3000:
 * test songs and verses showed up on the church projector with nobody
 * presenting (T-030). The suite must only ever drive the throwaway servers it
 * starts itself (one per worker), on their own ports and databases.
 */
const webServers = [config.webServer ?? []].flat()

test.describe('E2E test server isolation', () => {
  test('starts one server per worker', () => {
    expect(webServers).toHaveLength(config.workers as number)
  })

  test('never reuses a server that is already running', () => {
    for (const server of webServers) {
      expect(server.reuseExistingServer).toBe(false)
    }
  })

  // An HTTP readiness probe has no socket timeout: one unanswered request
  // made a run wait 180 s for a server that was ready in 0.2 s (T-056).
  test('starts on the server Ready line, not on an HTTP probe', () => {
    for (const server of webServers) {
      expect(server.url).toBeUndefined()
      expect(server.port).toBeUndefined()
      expect(server.wait?.stdout).toBe(SERVER_READY_LINE)
    }
    expect('[startup] === Server Ready (total: 154.5ms) ===').toMatch(
      SERVER_READY_LINE,
    )
    expect('[startup] Boot server listening on 3099').not.toMatch(
      SERVER_READY_LINE,
    )
  })

  test('never frees the app ports or proxies to the dev server', () => {
    for (const server of webServers) {
      expect(server.command).not.toContain('dev:web')
      expect(['3000', '3001']).not.toContain(server.env?.PORT)
    }
  })

  test('each server has its own port and database', async ({ request }) => {
    const ports = webServers.map((server) => server.env?.PORT)
    const databases = webServers.map((server) =>
      server.env?.DATABASE_PATH?.replaceAll('\\', '/'),
    )
    expect(new Set(ports).size).toBe(webServers.length)
    expect(new Set(databases).size).toBe(webServers.length)
    for (const database of databases) {
      expect(database).toMatch(/e2e\/\.test-data\/server-\d+\/app\.db$/)
    }
    expect((await request.get('/ping')).ok()).toBe(true)
  })
})
