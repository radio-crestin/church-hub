import { expect, test } from '@playwright/test'

/**
 * The server-wide origin gate in front of the local Church Hub Cloud routes
 * (another site's Origin is refused), and what the routes add to it:
 * changes must be JSON (so a browser preflights them), restore and
 * delete-all need a single-use confirmation from the UI, and the sign-in
 * callback takes only a sign-in this PC started.
 */

const BACKUP_ID = 'A'.repeat(22)
const OTHER_BACKUP_ID = 'B'.repeat(22)

test.describe('Church Hub Cloud: local route guards', () => {
  test.beforeEach(async ({ request }) => {
    await request.post('/api/backup/cloud/sign-out', {
      data: { deleteBackups: false },
    })
  })

  test('another site’s Origin gets 403 on every route, preflight included', async ({
    request,
  }) => {
    const foreign = { Origin: 'https://evil.example' }
    const calls: [string, string, Record<string, string>][] = [
      ['GET', '/api/backup/cloud/status', foreign],
      ['GET', '/api/backup/cloud/backups', foreign],
      ['POST', '/api/backup/cloud/sign-in', foreign],
      ['POST', '/api/backup/cloud/backups', foreign],
      ['POST', '/api/backup/cloud/sign-out', foreign],
      [
        'OPTIONS',
        '/api/backup/cloud/sign-in',
        { ...foreign, 'Access-Control-Request-Method': 'POST' },
      ],
      [
        'OPTIONS',
        '/api/backup/cloud/status',
        { ...foreign, 'Access-Control-Request-Method': 'GET' },
      ],
    ]
    for (const [method, path, headers] of calls) {
      const response = await request.fetch(path, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        ...(method === 'POST' && { data: {} }),
      })
      expect(`${method} ${path} ${response.status()}`).toBe(
        `${method} ${path} 403`,
      )
      expect(response.headers()['access-control-allow-origin']).toBeUndefined()
    }
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
      // A form body (what a cross-site form can send): the server-wide gate.
      const form = await request.fetch(path, {
        method,
        data: 'deleteBackups=true',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      expect(`${method} ${path} ${form.status()}`).toBe(`${method} ${path} 403`)
      // Any other non-JSON body: these routes' own check.
      const other = await request.fetch(path, {
        method,
        data: 'deleteBackups=true',
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      expect(`${method} ${path} ${other.status()}`).toBe(
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
