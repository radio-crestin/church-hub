import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from '@playwright/test'

import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'
import { makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * Cloud sync's owner (T-172): Google sign-in through the self-hosted sync
 * service (Google itself stood in for), a guest church claimed later, the
 * cloud identity kept in local backups and restored from them, the question
 * a second PC with the same church raises, revoking every device, recovery
 * on a new PC and transferring ownership.
 */

const OWNER = { sub: 'google-owner-1', email: 'owner@example.com' }
const NEXT_OWNER = { sub: 'google-owner-2', email: 'next.owner@example.com' }
const OTHER_PC = { id: 'e2e-other-pc-install', name: 'BACKUP-PC' }

/**
 * The PC uploads the suite's whole library (tens of thousands of songs)
 * right after turning cloud sync on, which keeps the server busy a while.
 */
const SLOW = { timeout: 60_000 }

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()

interface CloudIdentityRow {
  church_id: string
  read_url: string
  server_token: string
  owner_email: string | null
}

async function cloudStatus(request: APIRequestContext) {
  return (await (await request.get('/api/sync/status')).json()).data
}

/** What a PC (this one, or the spec acting as another) asks the service. */
function asPc(token: string, pc: { id: string; name: string } | null) {
  return {
    Authorization: `Bearer ${token}`,
    ...(pc && {
      'X-Church-Hub-Installation': pc.id,
      'X-Church-Hub-Installation-Name': pc.name,
    }),
  }
}

/** Signs the owner in the way the browser would, without a page. */
async function signInByRedirects(
  request: APIRequestContext,
  intent: 'connect' | 'claim' | 'manage',
) {
  const started = await request.post('/api/sync/cloud/owner/sign-in', {
    data: { intent },
  })
  expect(started.status()).toBe(200)
  const page = await fetch((await started.json()).data.authUrl)
  return page.text()
}

/**
 * Clicks a sign-in button and follows the Google window to the page it
 * ends on, on this PC: it must say the sign-in worked.
 */
async function signInFromPage(page: Page, button: string) {
  const popup = page.waitForEvent('popup')
  await page.getByTestId(button).click()
  const window = await popup
  await window.waitForURL(/\/api\/sync\/cloud\/owner\/callback/, {
    timeout: 30_000,
  })
  await expect(window.locator('body')).toContainText('Signed in as')
}

test.describe
  .serial('Cloud sync owner', () => {
    test.setTimeout(240_000)

    let churchId = ''
    let folder = ''
    let backupIdentity: CloudIdentityRow

    test.beforeAll(async ({ request }) => {
      await s3.start()
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        SYNC_COMPACT_AFTER: '100000',
      })
      // A leftover church from another spec would hide the guest flow.
      await request.delete('/api/sync/cloud')
      await request.post('/api/sync/cloud/owner/sign-out')
      folder = makeTempDir('church-hub-e2e-cloud-owner-')
      await request.put('/api/backup/config', {
        data: { localBackupPath: folder },
      })
    })

    test.afterAll(async ({ request }) => {
      await request.delete('/api/sync/cloud')
      await request.post('/api/sync/cloud/owner/sign-out')
      await request.put('/api/backup/config', {
        data: { localBackupPath: null },
      })
      removeTempDir(folder)
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('a guest church is claimed later by signing in with Google', async ({
      page,
      request,
    }) => {
      await page.goto('/settings/backup')
      const section = page.getByTestId('cloud-sync-section')
      await section.getByTestId('cloud-continue-guest').click()
      await expect(section.getByTestId('cloud-guest')).toBeVisible(SLOW)
      churchId = (await cloudStatus(request)).cloud.churchId
      expect(churchId).toMatch(/^[A-Za-z0-9_-]{16}$/)

      google.account = OWNER
      await signInFromPage(page, 'cloud-claim')
      await expect(section.getByTestId('cloud-owner-email')).toContainText(
        OWNER.email,
        SLOW,
      )
      // Signed in as the owner, its tools are there, with this church listed.
      await expect(section.getByTestId('cloud-owner-tools')).toBeVisible(SLOW)
      await expect(section.getByTestId(`owner-church-${churchId}`)).toBeVisible(
        SLOW,
      )
    })

    test('a local backup holds the church id, path, token and owner, and restoring it reconnects', async ({
      page,
      request,
    }) => {
      // The backup screen says the file holds the cloud keys.
      await page.goto('/settings/backup')
      await expect(page.getByTestId('cloud-backup-warning')).toBeVisible()

      expect((await request.post('/api/backup/local/now')).status()).toBe(200)
      const [fileName] = readdirSync(folder).filter((n) => n.endsWith('.db'))
      const backup = new DatabaseSync(join(folder, fileName as string), {
        readOnly: true,
      })
      backupIdentity = backup
        .prepare(
          'SELECT church_id, read_url, server_token, owner_email FROM cloud_sync',
        )
        .get() as unknown as CloudIdentityRow
      backup.close()
      expect(backupIdentity).toMatchObject({
        church_id: churchId,
        owner_email: OWNER.email,
      })
      // The read path's secret is in the read URL; the token is the server's.
      expect(backupIdentity.read_url).toMatch(
        new RegExp(`/churches/${churchId}-[A-Za-z0-9_-]{43}$`),
      )
      expect(backupIdentity.server_token).toMatch(/^chs_/)

      await request.delete('/api/sync/cloud')
      expect((await cloudStatus(request)).cloud).toBeNull()

      const restored = await request.post('/api/backup/local/restore', {
        data: { fileName },
      })
      expect((await restored.json()).data.success).toBe(true)
      const status = await cloudStatus(request)
      expect(status).toMatchObject({
        transport: 'cloud',
        connected: true,
        cloud: { churchId, ownerEmail: OWNER.email, serverConflict: null },
      })
      expect((await request.post('/api/sync/now')).status()).toBe(200)
      expect((await cloudStatus(request)).lastError).toBeNull()
    })

    test('the backup restored on a second PC: the user picks which PC keeps the church', async ({
      page,
      request,
    }) => {
      const path = `${service.url}/sync/churches/${churchId}/path`
      // The second PC, with the same token from the backup, is told the
      // church is held by this PC.
      const refused = await fetch(path, {
        headers: asPc(backupIdentity.server_token, OTHER_PC),
      })
      expect(refused.status).toBe(409)
      expect(await refused.json()).toMatchObject({
        code: 'server_in_use',
        otherPc: { name: expect.any(String) },
      })

      // Its user keeps the church there.
      const takeover = await fetch(
        `${service.url}/sync/churches/${churchId}/takeover`,
        {
          method: 'POST',
          headers: asPc(backupIdentity.server_token, OTHER_PC),
        },
      )
      expect(takeover.status).toBe(200)

      // This PC learns it on its next write, and asks.
      const song = await request.post('/api/songs', {
        data: {
          title: `E2E Owner ${Date.now()}`,
          slides: [{ content: 'one', sortOrder: 0, label: 'V1' }],
        },
      })
      expect(song.status()).toBeLessThan(300)
      await request.post('/api/sync/now')
      await page.goto('/settings/backup')
      const conflict = page.getByTestId('cloud-conflict')
      await expect(conflict).toContainText(OTHER_PC.name, SLOW)
      expect((await cloudStatus(request)).lastError).toBe('server_in_use')

      await conflict.getByTestId('cloud-keep-here').click()
      await expect(conflict).toBeHidden(SLOW)
      // Now the other PC is the one refused.
      const after = await fetch(path, {
        headers: asPc(backupIdentity.server_token, OTHER_PC),
      })
      expect(after.status).toBe(409)
      await expect
        .poll(async () => {
          await request.post('/api/sync/now')
          return (await cloudStatus(request)).lastError
        }, SLOW)
        .toBeNull()
    })

    test('the owner revokes every device: phones, the old token and the old path stop working', async ({
      page,
      request,
    }) => {
      const user = await request.post('/api/users', {
        data: {
          name: `E2E Owner Phone ${Date.now()}`,
          permissions: ['songs.view'],
        },
      })
      const userId = (await user.json()).data.user.id as number
      const device = await request.post('/api/sync/cloud/devices', {
        data: { userId, name: 'E2E phone' },
      })
      expect(device.status()).toBe(201)
      const phone = (await device.json()).data as {
        token: string
        readUrl: string
      }
      const pathUrl = `${service.url}/sync/churches/${churchId}/path`
      expect(
        (await fetch(pathUrl, { headers: asPc(phone.token, null) })).status,
      ).toBe(200)

      await page.goto('/settings/backup')
      const tools = page.getByTestId('cloud-owner-tools')
      await tools.getByTestId('cloud-revoke-all').click()
      const confirm = page.getByTestId('cloud-revoke-confirm')
      await confirm.getByRole('button', { name: /revo/i }).click()
      await expect(confirm).toBeHidden({ timeout: 20_000 })

      expect(
        (await fetch(pathUrl, { headers: asPc(phone.token, null) })).status,
      ).toBe(401)
      expect(
        (
          await fetch(pathUrl, {
            headers: asPc(backupIdentity.server_token, null),
          })
        ).status,
      ).toBe(401)
      expect((await fetch(`${phone.readUrl}/head.json`)).status).toBe(404)
      // This PC keeps syncing with its fresh token, at the new path.
      expect((await request.post('/api/sync/now')).status()).toBe(200)
      expect((await cloudStatus(request)).lastError).toBeNull()
    })

    test('the owner recovers the church on a new PC by signing in with Google', async ({
      page,
      request,
    }) => {
      // A reinstalled PC: no church, nobody signed in.
      await request.delete('/api/sync/cloud')
      await request.post('/api/sync/cloud/owner/sign-out')

      await page.goto('/settings/backup')
      const section = page.getByTestId('cloud-sync-section')
      google.account = OWNER
      await signInFromPage(page, 'cloud-recover-google')
      const church = section.getByTestId(`owner-church-${churchId}`)
      await church.getByTestId('owner-church-recover').click(SLOW)
      await expect(section.getByTestId('cloud-owner-email')).toContainText(
        OWNER.email,
        SLOW,
      )
      expect((await cloudStatus(request)).cloud.churchId).toBe(churchId)
      await expect
        .poll(async () => {
          await request.post('/api/sync/now')
          return (await cloudStatus(request)).lastError
        }, SLOW)
        .toBeNull()
    })

    test('the owner transfers the church; it is the new owner’s once accepted', async ({
      request,
    }) => {
      const offered = await request.post(
        `/api/sync/cloud/owner/churches/${churchId}/transfer`,
        { data: { email: NEXT_OWNER.email } },
      )
      expect(offered.status()).toBe(200)

      google.account = NEXT_OWNER
      expect(await signInByRedirects(request, 'manage')).toContain(
        NEXT_OWNER.email,
      )
      const listed = await request.get('/api/sync/cloud/owner/churches')
      expect((await listed.json()).data.churches).toEqual([
        expect.objectContaining({ churchId, role: 'pending' }),
      ])
      const accepted = await request.post(
        `/api/sync/cloud/owner/churches/${churchId}/accept`,
      )
      expect(accepted.status()).toBe(200)
      expect((await cloudStatus(request)).cloud.ownerEmail).toBe(
        NEXT_OWNER.email,
      )

      // The previous owner no longer finds it, and can't act on it.
      google.account = OWNER
      await signInByRedirects(request, 'manage')
      const theirs = await request.get('/api/sync/cloud/owner/churches')
      expect((await theirs.json()).data.churches).toEqual([])
      const transfer = await request.post(
        `/api/sync/cloud/owner/churches/${churchId}/transfer`,
        { data: { email: OWNER.email } },
      )
      expect(transfer.status()).toBe(403)
    })

    test('a sign-in only counts on the PC that started it, and tickets can’t be forged', async ({
      request,
    }) => {
      await request.post('/api/sync/cloud/owner/sign-out')
      // A ticket handed to this PC without its nonce is refused.
      const stray = await request.get(
        '/api/sync/cloud/owner/callback?nonce=not-ours-not-ours-1&ticket=cho_x.y&expiresAt=9999999999',
      )
      expect(await stray.text()).toContain('unknown_sign_in')
      expect((await cloudStatus(request)).ownerSession).toBeNull()

      // The service hands tickets only back to a loopback (or allowed) page.
      const elsewhere = await fetch(
        `${service.url}/sync/owner/sign-in?returnUrl=${encodeURIComponent('https://evil.example/cb')}&nonce=abcdefghijklmnop`,
        { redirect: 'manual' },
      )
      expect(elsewhere.status).toBe(400)

      const forged = await fetch(`${service.url}/sync/owner/churches`, {
        headers: {
          Authorization: `Bearer cho_${'a'.repeat(20)}.${'0'.repeat(64)}`,
        },
      })
      expect(forged.status).toBe(401)

      // Another account can't claim a church that has an owner.
      google.account = { sub: 'google-stranger', email: 'stranger@example.com' }
      const page = await signInByRedirects(request, 'claim')
      expect(page).toContain('already_owned')
      expect((await cloudStatus(request)).cloud.ownerEmail).toBe(
        NEXT_OWNER.email,
      )
    })

    test('every owner endpoint is in the OpenAPI specs', async ({
      request,
    }) => {
      const app = await (await request.get('/api/openapi.json')).json()
      for (const path of [
        '/api/sync/cloud/owner/sign-in',
        '/api/sync/cloud/owner/callback',
        '/api/sync/cloud/owner/sign-out',
        '/api/sync/cloud/owner/churches',
        '/api/sync/cloud/owner/churches/{churchId}/recover',
        '/api/sync/cloud/owner/churches/{churchId}/transfer',
        '/api/sync/cloud/owner/churches/{churchId}/accept',
        '/api/sync/cloud/owner/reset',
        '/api/sync/cloud/keep',
      ]) {
        expect(app.paths, path).toHaveProperty([path])
      }
      const spec = await (
        await fetch(`${service.url}/sync/openapi.json`)
      ).json()
      for (const path of [
        '/sync/churches/{churchId}/owner',
        '/sync/churches/{churchId}/takeover',
        '/sync/owner/sign-in',
        '/sync/owner/callback',
        '/sync/owner/churches',
        '/sync/owner/churches/{churchId}/recover',
        '/sync/owner/churches/{churchId}/reset',
        '/sync/owner/churches/{churchId}/transfer',
        '/sync/owner/churches/{churchId}/accept',
      ]) {
        expect(spec.paths, path).toHaveProperty([path])
      }
    })
  })
