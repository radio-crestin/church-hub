import { DatabaseSync } from 'node:sqlite'
import { gunzipSync } from 'node:zlib'
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
import { TEST_DB_PATH } from '../playwright.config'

/**
 * Church Hub Cloud backup (free, Google sign-in), against the self-hosted
 * backend with Google and the private bucket stood in for: sign in from
 * Settings > Backup; back up (the church's data encrypted, the shared
 * resources as plaintext blobs holding nothing church-private); a second
 * backup sends no blob again; restore checks every hash and puts the data
 * and the resources back; delete one; then sign out deleting everything.
 */

const ACCOUNT = { sub: 'google-backup-1', email: 'backup.owner@example.com' }
const BUCKET = 'church-hub-backups'
const MARKER = '/api/settings/app_settings/e2e_cloud_backup_marker'
/** Backing up or restoring the suite's whole database takes a while. */
const SLOW = { timeout: 180_000 }
/** What blobs may hold; anything else is church data and must be encrypted. */
const RESOURCE_TABLES = ['song_slides', 'bible_books', 'bible_verses']

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

/** The stored objects under a prefix of the bucket. */
const stored = (prefix: string) =>
  [...s3.objects.entries()].filter(([key]) =>
    key.startsWith(`/${BUCKET}/${prefix}`),
  )

/** Counts in the test server's database (read-only). */
function counts() {
  const db = new DatabaseSync(TEST_DB_PATH, { readOnly: true })
  try {
    const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n
    return {
      verses: count('SELECT COUNT(*) AS n FROM bible_verses'),
      slides: count('SELECT COUNT(*) AS n FROM song_slides'),
      songs: count('SELECT COUNT(*) AS n FROM songs'),
      indexedSongs: count('SELECT COUNT(DISTINCT song_id) AS n FROM songs_fts'),
    }
  } finally {
    db.close()
  }
}

async function setMarker(request: APIRequestContext, value: string) {
  const res = await request.post('/api/settings/app_settings', {
    data: { key: 'e2e_cloud_backup_marker', value },
  })
  expect(res.ok()).toBe(true)
}

async function readMarker(request: APIRequestContext) {
  return (await (await request.get(MARKER)).json()).data?.value
}

async function confirmToken(request: APIRequestContext, data: object) {
  const res = await request.post('/api/backup/cloud/confirmations', { data })
  return (await res.json()).data.token as string
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
    test.setTimeout(400_000)

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
      await request.post('/api/backup/cloud/sign-out', {
        data: {
          deleteBackups: true,
          confirmToken: await confirmToken(request, {
            action: 'delete-account',
          }),
        },
      })
      await request.delete(MARKER)
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('the church’s data is encrypted; shared resources travel as plain blobs, once', async ({
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
      const settings = await (
        await request.get('/api/settings/app_settings')
      ).text()
      for (const text of [status, settings])
        expect(text).not.toMatch(/chb[agr]_/)

      await panel.getByTestId('cloud-backup-now').click()
      await expect(panel.getByTestId('cloud-backup-row')).toHaveCount(1, SLOW)

      // The user part and manifest: ciphertext only.
      const own = stored('backups/')
      expect(own.map(([key]) => key.split('/').pop()).sort()).toEqual([
        'manifest.chb',
        'user.chb',
      ])
      for (const [, body] of own) {
        expect(body.subarray(0, 8).toString()).toBe('CHBACKUP')
        expect(body.includes(Buffer.from('SQLite format 3'))).toBe(false)
        expect(body.includes(Buffer.from('before the backup'))).toBe(false)
      }

      // The blobs: plaintext, named by the SHA-256 of their contents, holding
      // only Bible and library-song slide rows, nothing church-private.
      const blobs = stored('blobs/')
      expect(blobs.length).toBeGreaterThan(1)
      for (const [key, body] of blobs) {
        expect(key).toMatch(
          /\/blobs\/[0-9a-f]{64}\/[A-Za-z0-9_-]{22}\/[0-9a-f]{64}$/,
        )
        const text = gunzipSync(body).toString('utf8')
        expect(
          text.startsWith('{"format":"church-hub-resource","version":1}'),
        ).toBe(true)
        const tables = text
          .split('\n')
          .filter((line) => line.startsWith('{"table"'))
          .map((line) => JSON.parse(line).table)
        for (const table of tables) expect(RESOURCE_TABLES).toContain(table)
        for (const secret of [
          'before the backup',
          ACCOUNT.email,
          'Super Admin',
          'chbr_',
        ]) {
          expect(text.includes(secret)).toBe(false)
        }
      }

      // A second backup with the same resources sends none of them again.
      const requestsBefore = s3.requests.length
      const second = await request.post('/api/backup/cloud/backups', {
        data: {},
        timeout: SLOW.timeout,
      })
      expect(second.status()).toBe(200)
      expect((await second.json()).data.backup.sentBlobs).toBe(0)
      const blobPuts = s3.requests
        .slice(requestsBefore)
        .filter((line) => line.startsWith('PUT') && line.includes('/blobs/'))
      expect(blobPuts).toEqual([])
      expect(stored('blobs/')).toHaveLength(blobs.length)
    })

    test('restore checks every hash and puts the data and resources back', async ({
      page,
      request,
    }) => {
      const before = counts()
      await setMarker(request, 'changed after the backup')
      await page.goto('/settings/backup')
      const panel = page.getByTestId('cloud-backup-panel')
      await panel.getByTestId('cloud-backup-restore').first().click()
      const confirm = page.getByTestId('cloud-backup-confirm')
      await confirmButton(confirm).click()
      await expect
        .poll(() => readMarker(request), SLOW)
        .toBe('before the backup')

      // Bible texts and library songs came back from the blobs, and the
      // search indexes were rebuilt.
      await expect
        .poll(() => counts(), SLOW)
        .toEqual({
          ...before,
          indexedSongs: before.songs,
        })
      // Restoring kept this PC signed in.
      await page.goto('/settings/backup')
      await expect(panel.getByTestId('cloud-backup-email')).toContainText(
        ACCOUNT.email,
        SLOW,
      )

      // Deleting one backup keeps the blobs the other still needs.
      const blobCount = stored('blobs/').length
      await panel.getByTestId('cloud-backup-delete').first().click()
      await confirmButton(confirm).click()
      await expect(panel.getByTestId('cloud-backup-row')).toHaveCount(1)
      expect(stored('blobs/')).toHaveLength(blobCount)
    })

    test('a changed resource blob makes the restore refuse, leaving the data alone', async ({
      request,
    }) => {
      const [key, body] = stored('blobs/')[0]
      const tampered = gunzipSync(body)
        .toString('utf8')
        .replace(/"[^"]{3}/, '"XYZ')
      const { gzipSync } = await import('node:zlib')
      s3.objects.set(key, gzipSync(Buffer.from(tampered)))
      await setMarker(request, 'kept when the restore is refused')

      const listed = await (
        await request.get('/api/backup/cloud/backups')
      ).json()
      const backupId = listed.data.backups[0].id as string
      const refused = await request.post(
        `/api/backup/cloud/backups/${backupId}/restore`,
        {
          data: {
            confirmToken: await confirmToken(request, {
              action: 'restore',
              backupId,
            }),
          },
          timeout: SLOW.timeout,
        },
      )
      expect(refused.status()).toBe(422)
      expect((await refused.json()).error).toBe('backup_unreadable')
      expect(await readMarker(request)).toBe('kept when the restore is refused')
      s3.objects.set(key, body)
    })

    test('sign out and delete my cloud backups removes them all', async ({
      page,
      request,
    }) => {
      await page.goto('/settings/backup')
      const panel = page.getByTestId('cloud-backup-panel')
      await panel.getByTestId('cloud-backup-delete-account').click()
      await confirmButton(
        page.getByTestId('cloud-backup-sign-out-modal'),
      ).click()
      await expect(panel.getByTestId('cloud-backup-sign-in')).toBeVisible()

      expect(stored('backups/')).toEqual([])
      expect(stored('blobs/')).toEqual([])
      expect(s3.multipart.size).toBe(0)
      const listed = await request.get('/api/backup/cloud/backups')
      expect(listed.status()).toBe(401)
      expect((await listed.json()).error).toBe('cloud_sign_in_required')
    })
  })
