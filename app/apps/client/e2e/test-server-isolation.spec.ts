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

  test('never frees port 3000 or proxies to the dev server', ({}, testInfo) => {
    expect(testInfo.config.webServer?.command).not.toContain('dev:web')
  })

  test('uses its own port and database unless told otherwise', async ({
    request,
    baseURL,
  }, testInfo) => {
    if (!process.env.TEST_PORT) {
      expect(new URL(baseURL ?? '').port).not.toBe('3000')
    }
    expect(testInfo.config.webServer?.command).toContain(
      'e2e/.test-data/app.db',
    )
    expect((await request.get('/ping')).ok()).toBe(true)
  })
})
