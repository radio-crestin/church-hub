import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'

import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'

/**
 * Church Hub Cloud backup (free, Google sign-in), against the self-hosted
 * backend with Google and the private bucket stood in for: sign in from
 * Settings > Backup, back up (only ciphertext reaches the bucket), restore
 * (the data comes back, this PC stays signed in), delete one, then sign out
 * deleting every cloud backup.
 */

const ACCOUNT = { sub: 'google-backup-1', email: 'backup.owner@example.com' }
const BUCKET = 'church-hub-backups'
const MARKER = '/api/settings/app_settings/e2e_cloud_backup_marker'
/** Backing up or restoring the suite's whole database takes a while. */
const SLOW = { timeout: 120_000 }

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()

/** The private bucket's settings, as the service is given them. */
const backupEnv = (endpoint: string) => ({
  BACKUP_SECRET: 'e2e-backup-secret',
  BACKUP_KEY_SECRET: 'e2e-backup-key-secret',
  BACKUP_S3_ENDPOINT: endpoint,
  BACKUP_S3_BUCKET: BUCKET,
  BACKUP_S3_REGION: 'us-east-1',
  BACKUP_S3_ACCESS_KEY_ID: 'e2e-backup-access-key',
  BACKUP_S3_SECRET_ACCESS_KEY: 'e2e-backup-secret-key',
})

/** The encrypted backups in the bucket. */
const storedBackups = () =>
  [...s3.objects.keys()].filter(
    (key) => key.startsWith(`/${BUCKET}/accounts/`) && key.endsWith('.chb'),
  )

async function setMarker(request: APIRequestContext, value: string) {
  const res = await request.post('/api/settings/app_settings', {
    data: { key: 'e2e_cloud_backup_marker', value },
  })
  expect(res.ok()).toBe(true)
}

async function readMarker(request: APIRequestContext) {
  return (await (await request.get(MARKER)).json()).data?.value
}

/** A confirm dialog's confirm button (its last), whatever the app language. */
const confirmButton = (dialog: Locator) => dialog.locator('button').last()

/** Clicks the sign-in and follows the Google window to this PC's page. */
async function signIn(page: Page) {
  const popup = page.waitForEvent('popup')
  await page.getByTestId('cloud-backup-sign-in').click()
  const window = await popup
  await window.waitForURL(/\/api\/backup\/cloud\/callback/, { timeout: 30_000 })
  await expect(window.locator('body')).toContainText(
    'Signed in to Church Hub Cloud',
  )
}

test.describe
  .serial('Church Hub Cloud backup', () => {
    test.setTimeout(300_000)

    test.beforeAll(async ({ request }) => {
      await s3.start()
      await google.start()
      google.account = ACCOUNT
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        ...backupEnv(s3.endpoint),
      })
      // A sign-in left over from another run would skip the sign-in step.
      await request.post('/api/backup/cloud/sign-out', {
        data: { deleteBackups: false },
      })
    })

    test.afterAll(async ({ request }) => {
      const confirmation = await request.post(
        '/api/backup/cloud/confirmations',
        { data: { action: 'delete-account' } },
      )
      await request.post('/api/backup/cloud/sign-out', {
        data: {
          deleteBackups: true,
          confirmToken: (await confirmation.json()).data.token,
        },
      })
      await request.delete(MARKER)
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('sign in, back up, restore and delete a backup', async ({
      page,
      request,
    }) => {
      await setMarker(request, 'before the backup')
      await page.goto('/settings/backup')
      const panel = page.getByTestId('cloud-backup-panel')
      await signIn(page)
      await expect(panel.getByTestId('cloud-backup-email')).toContainText(
        ACCOUNT.email,
      )

      // The refresh token stays in server_secrets: no route hands it out.
      const status = await (
        await request.get('/api/backup/cloud/status')
      ).text()
      expect(status).toContain(ACCOUNT.email)
      const settings = await (
        await request.get('/api/settings/app_settings')
      ).text()
      for (const text of [status, settings]) {
        expect(text).not.toMatch(/chb[agr]_/)
      }

      await panel.getByTestId('cloud-backup-now').click()
      await expect(panel.getByTestId('cloud-backup-row')).toHaveCount(1, SLOW)

      // Only ciphertext reached the bucket, under a keyed-hash account folder.
      const [key] = storedBackups()
      expect(key).toMatch(
        new RegExp(
          `^/${BUCKET}/accounts/[0-9a-f]{64}/backups/[A-Za-z0-9_-]{22}\\.chb$`,
        ),
      )
      const stored = s3.objects.get(key) as Buffer
      expect(stored.subarray(0, 8).toString()).toBe('CHBACKUP')
      expect(stored.includes(Buffer.from('SQLite format 3'))).toBe(false)
      expect(stored.includes(Buffer.from('before the backup'))).toBe(false)
      expect(key).not.toContain(ACCOUNT.email)

      await setMarker(request, 'changed after the backup')
      await panel.getByTestId('cloud-backup-restore').click()
      const confirm = page.getByTestId('cloud-backup-confirm')
      await confirmButton(confirm).click()
      await expect
        .poll(() => readMarker(request), SLOW)
        .toBe('before the backup')

      // Restoring kept this PC signed in.
      await page.goto('/settings/backup')
      await expect(panel.getByTestId('cloud-backup-email')).toContainText(
        ACCOUNT.email,
        SLOW,
      )
      await panel.getByTestId('cloud-backup-delete').click()
      await confirmButton(confirm).click()
      await expect(panel.getByTestId('cloud-backup-empty')).toBeVisible()
      expect(storedBackups()).toEqual([])
    })

    test('sign out and delete my cloud backups removes them all', async ({
      page,
      request,
    }) => {
      const made = await request.post('/api/backup/cloud/backups', {
        data: {},
        timeout: SLOW.timeout,
      })
      expect(made.status()).toBe(200)
      expect(storedBackups()).toHaveLength(1)

      await page.goto('/settings/backup')
      const panel = page.getByTestId('cloud-backup-panel')
      await panel.getByTestId('cloud-backup-delete-account').click()
      await confirmButton(
        page.getByTestId('cloud-backup-sign-out-modal'),
      ).click()
      await expect(panel.getByTestId('cloud-backup-sign-in')).toBeVisible()

      expect(storedBackups()).toEqual([])
      expect(s3.multipart.size).toBe(0)
      const listed = await request.get('/api/backup/cloud/backups')
      expect(listed.status()).toBe(401)
      expect((await listed.json()).error).toBe('cloud_sign_in_required')
    })
  })
