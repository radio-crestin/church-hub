import { expect, test } from '@playwright/test'

/**
 * A local e2e run once landed on the desktop app already serving port 3000:
 * test songs and verses showed up on the church projector with nobody
 * presenting (T-030). The suite must only ever drive the throwaway server it
 * starts itself, on its own port and database.
 */
test.describe('E2E test server isolation', () => {
  test('never reuses a server that is already running', ({}, testInfo) => {
    const webServer = testInfo.config.webServer
    expect(webServer?.reuseExistingServer).toBe(false)
  })

  // An HTTP readiness probe has no socket timeout: one unanswered request
  // made a run wait 180 s for a server that was ready in 0.2 s (T-056).
  test('starts on the server Ready line, not on an HTTP probe', ({}, testInfo) => {
    const webServer = testInfo.config.webServer
    expect(webServer?.url).toBeUndefined()
    expect(webServer?.port).toBeUndefined()
    expect(webServer?.wait?.stdout).toBeInstanceOf(RegExp)
    expect('[startup] === Server Ready (total: 154.5ms) ===').toMatch(
      webServer?.wait?.stdout as RegExp,
    )
    expect('[startup] Boot server listening on 3099').not.toMatch(
      webServer?.wait?.stdout as RegExp,
    )
  })

  test('never frees the app ports or proxies to the dev server', ({}, testInfo) => {
    expect(testInfo.config.webServer?.command).not.toContain('dev:web')
  })

  test('uses its own port and database unless told otherwise', async ({
    request,
    baseURL,
  }, testInfo) => {
    if (!process.env.TEST_PORT) {
      expect(['3000', '3001']).not.toContain(new URL(baseURL ?? '').port)
    }
    expect(testInfo.config.webServer?.command).toContain(
      'e2e/.test-data/app.db',
    )
    expect((await request.get('/ping')).ok()).toBe(true)
  })
})
