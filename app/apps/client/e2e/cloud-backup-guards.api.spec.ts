import { expect, test } from '@playwright/test'

/**
 * The local Church Hub Cloud routes can't be driven by another website open
 * in the operator's browser: changes must come from the app's own UI as
 * JSON, restore and delete-all need a single-use confirmation from the UI,
 * and the sign-in callback takes only a sign-in this PC started.
 */

const BACKUP_ID = 'A'.repeat(22)
const OTHER_BACKUP_ID = 'B'.repeat(22)

test.describe('Church Hub Cloud: local route guards', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/backup/cloud/sign-out', {
      data: { deleteBackups: false },
    })
  })

  test('a request from another site is refused', async ({ request }) => {
    const foreign = await request.post('/api/backup/cloud/sign-in', {
      data: {},
      headers: { Origin: 'https://evil.example' },
    })
    expect(foreign.status()).toBe(403)
    expect((await foreign.json()).error).toBe('foreign_origin')

    const crossSite = await request.post('/api/backup/cloud/backups', {
      data: {},
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(crossSite.status()).toBe(403)

    const otherPort = await request.post('/api/backup/cloud/sign-in', {
      data: {},
      headers: { Origin: 'http://localhost:1' },
    })
    expect(otherPort.status()).toBe(403)
  })

  test('the desktop webview’s own origin passes, even cross-site', async ({
    request,
  }) => {
    const webview = await request.post('/api/backup/cloud/sign-in', {
      data: {},
      headers: {
        Origin: 'http://tauri.localhost',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    expect(webview.status()).toBe(200)
    expect((await webview.json()).data.authUrl).toContain('/backup/sign-in')
  })

  test('a change that isn’t JSON is refused, so a browser must preflight', async ({
    request,
  }) => {
    for (const [method, path] of [
      ['POST', '/api/backup/cloud/backups'],
      ['POST', '/api/backup/cloud/sign-out'],
      ['PUT', '/api/backup/cloud/config'],
      ['DELETE', `/api/backup/cloud/backups/${BACKUP_ID}`],
    ] as const) {
      const response = await request.fetch(path, {
        method,
        data: 'deleteBackups=true',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      expect(`${method} ${path} ${response.status()}`).toBe(
        `${method} ${path} 415`,
      )
    }
  })

  test('restore and delete-all need a fresh confirmation from the UI', async ({
    request,
  }) => {
    const restore = (confirmToken?: string) =>
      request.post(`/api/backup/cloud/backups/${BACKUP_ID}/restore`, {
        data: { confirmToken },
      })
    expect((await (await restore()).json()).error).toBe('confirmation_required')

    const confirm = async (data: Record<string, string>) =>
      (
        await (
          await request.post('/api/backup/cloud/confirmations', { data })
        ).json()
      ).data.token as string

    // A confirmation for another backup doesn't restore this one.
    const forOther = await confirm({
      action: 'restore',
      backupId: OTHER_BACKUP_ID,
    })
    expect((await restore(forOther)).status()).toBe(400)

    // The right one gets past the guard (then: not signed in), once.
    const token = await confirm({ action: 'restore', backupId: BACKUP_ID })
    const first = await restore(token)
    expect(first.status()).toBe(401)
    expect((await first.json()).error).toBe('cloud_sign_in_required')
    expect((await (await restore(token)).json()).error).toBe(
      'confirmation_required',
    )

    const deleteAll = await request.post('/api/backup/cloud/sign-out', {
      data: { deleteBackups: true },
    })
    expect(deleteAll.status()).toBe(400)
    expect((await deleteAll.json()).error).toBe('confirmation_required')
  })

  test('the callback takes only a sign-in this PC started', async ({
    request,
  }) => {
    const planted = await request.get(
      '/api/backup/cloud/callback?nonce=planted-by-someone-else&grant=chbg_x.y',
    )
    expect(await planted.text()).toContain('Sign-in failed')
    const status = await (await request.get('/api/backup/cloud/status')).json()
    expect(status.data.signedIn).toBe(false)
  })
})
