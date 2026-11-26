import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { setAppLanguage } from './helpers/app-language'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'

/**
 * A removed or deactivated user's devices are signed out at once: the users
 * page says so before it acts, the sync service refuses the device's token
 * and moves the church to a new path it never learns. Reactivating the user
 * doesn't bring the device back.
 */

const s3 = new FakeS3()
const service = new SyncService()

interface Device {
  token: string
  readUrl: string
}

async function addUserWithDevice(
  request: APIRequestContext,
  name: string,
): Promise<{ userId: number; device: Device }> {
  const user = await request.post('/api/users', {
    data: { name, permissions: ['songs.view', 'songs.edit'] },
  })
  const userId = (await user.json()).data.user.id as number
  const minted = await request.post('/api/sync/cloud/devices', {
    data: { userId, name: `${name} phone` },
  })
  expect(minted.status()).toBe(201)
  return { userId, device: (await minted.json()).data }
}

/** What the device's token gets from the sync service: the church's path. */
async function askPath(churchId: string, token: string) {
  const response = await fetch(
    `${service.url}/sync/churches/${churchId}/path`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return {
    status: response.status,
    readUrl: ((await response.json()) as { readUrl?: string }).readUrl,
  }
}

async function phoneWrite(churchId: string, token: string) {
  const uuid = `e2e-${Date.now()}`
  const response = await fetch(
    `${service.url}/sync/churches/${churchId}/changes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        changes: [
          {
            type: 'song',
            uuid,
            op: 'upsert',
            baseVersion: 0,
            data: { uuid, title: 'Nope', updatedAt: 1 },
          },
        ],
      }),
    },
  )
  return response.status
}

/** The users page, once it knows each user's devices, with `name`'s menu open. */
async function openUserMenu(page: Page, name: string) {
  const devicesLoaded = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/sync/cloud/devices') && response.ok(),
  )
  await page.goto('/settings/users')
  await devicesLoaded
  const card = page.getByTestId('user-card').filter({ hasText: name })
  await card.getByTestId('user-menu').click()
  return card
}

test.describe
  .serial('Signing out a removed user’s devices', () => {
    test.setTimeout(120_000)

    let churchId = ''

    /** The service refuses `token`, once the server has signed it out. */
    const expectSignedOut = (token: string) =>
      expect
        .poll(async () => (await askPath(churchId, token)).status, {
          timeout: 60_000,
        })
        .toBe(401)

    test.beforeAll(async ({ request }) => {
      s3.signedWritesOnly = true
      await s3.start()
      await service.start(s3.endpoint, { SYNC_COMPACT_AFTER: '100000' })
      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      churchId = (await connected.json()).data.churchId
    })

    test.afterAll(async ({ request }) => {
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await s3.stop()
    })

    test('a user removed while the library is still uploading is signed out before the upload ends', async ({
      request,
    }) => {
      const { userId, device } = await addUserWithDevice(
        request,
        `E2E Mid-upload ${Date.now()}`,
      )
      const removed = await request.delete(`/api/users/${userId}`)
      expect(removed.ok()).toBe(true)

      // The server's writes go one at a time: the sign-out waits for the
      // chunk in flight, not for the whole upload.
      await expectSignedOut(device.token)
      const status = await (await request.get('/api/sync/status')).json()
      expect(status.data.pendingCount).toBeGreaterThan(0)
    })

    test('removing a user signs out their device, which never learns the new path', async ({
      page,
      request,
    }) => {
      const name = `E2E Removed ${Date.now()}`
      const removed = await addUserWithDevice(request, name)
      const stays = await addUserWithDevice(request, `E2E Stays ${Date.now()}`)
      const before = await askPath(churchId, removed.device.token)
      expect(before).toEqual({ status: 200, readUrl: removed.device.readUrl })

      await setAppLanguage(page, 'en')
      await openUserMenu(page, name)
      await page.getByRole('button', { name: 'Delete', exact: true }).click()
      const confirm = page.getByTestId('user-delete-confirm')
      await expect(confirm.getByTestId('user-devices-signed-out')).toHaveText(
        'Their device will be signed out. To join again, it has to be added again.',
      )
      await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(
        page.getByTestId('user-card').filter({ hasText: name }),
      ).toHaveCount(0)

      // Refused for reads and writes; the old path is gone. The server signs
      // the device out after answering: the library may still be uploading.
      await expectSignedOut(removed.device.token)
      expect(await phoneWrite(churchId, removed.device.token)).toBe(401)
      expect((await fetch(`${before.readUrl}/head.json`)).status).toBe(404)

      // Everyone else, the PC included, reads from the new path.
      const moved = await askPath(churchId, stays.device.token)
      expect(moved.status).toBe(200)
      expect(moved.readUrl).not.toBe(before.readUrl)
      expect((await fetch(`${moved.readUrl}/head.json`)).status).toBe(200)
      const another = await request.post('/api/sync/cloud/devices', {
        data: { userId: stays.userId, name: 'Second phone' },
      })
      expect((await another.json()).data.readUrl).toBe(moved.readUrl)
    })

    test('deactivating a user asks first, signs out their device, and reactivating does not bring it back', async ({
      page,
      request,
    }) => {
      const name = `E2E Deactivated ${Date.now()}`
      const { userId, device } = await addUserWithDevice(request, name)

      await setAppLanguage(page, 'en')
      const card = await openUserMenu(page, name)
      await page
        .getByRole('button', { name: 'Deactivate', exact: true })
        .click()
      const confirm = page.getByTestId('user-deactivate-confirm')
      await expect(confirm).toContainText(
        `"${name}" will no longer be able to sign in.`,
      )
      await expect(confirm.getByTestId('user-devices-signed-out')).toBeVisible()
      await confirm
        .getByRole('button', { name: 'Deactivate', exact: true })
        .click()
      await expect(card).toContainText('Inactive')

      await expectSignedOut(device.token)
      expect(await phoneWrite(churchId, device.token)).toBe(401)

      const reactivated = await request.put(`/api/users/${userId}`, {
        data: { isActive: true },
      })
      expect(reactivated.ok()).toBe(true)
      await request.post('/api/sync/now')
      expect((await askPath(churchId, device.token)).status).toBe(401)

      // With no device left, deactivating asks nothing more.
      await openUserMenu(page, name)
      await page
        .getByRole('button', { name: 'Deactivate', exact: true })
        .click()
      await expect(page.getByTestId('user-deactivate-confirm')).toHaveCount(0)
      await expect(card).toContainText('Inactive')
    })
  })
