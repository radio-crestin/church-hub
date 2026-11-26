import { afterEach, beforeEach, expect, test } from 'bun:test'
import { PART_SIZE } from '../src/backup/account/startUpload'
import { BackupHarness, backupEnv } from './support/backupHarness'

/**
 * Cloud backup storage: an encrypted user part and manifest per backup plus
 * shared, content-addressed resource blobs, all sent straight to the bucket
 * through short-lived presigned URLs signed for their exact sizes; every id
 * looked up only in the caller's own account. Run with `bun test` from
 * churchhub-backend/.
 */
const ALICE = { sub: 'google-sub-alice', email: 'alice@example.com' }
const BOB = { sub: 'google-sub-bob', email: 'bob@example.com' }

let harness: BackupHarness
beforeEach(() => {
  harness = new BackupHarness()
  harness.install()
})
afterEach(() => harness.restore())

const bytes = (size: number, fill = 7) => new Uint8Array(size).fill(fill)
const BIBLE = bytes(3000, 1)
const SONGS = bytes(2000, 2)

async function list(token: string) {
  const response = await harness.request('/backup/backups', {}, token)
  return (await response.json()) as {
    backups: { id: string; sizeBytes: number; blobCount: number }[]
    usage: { usedBytes: number; quotaBytes: number; retentionDays: number }
  }
}

const objectKeys = (prefix: string) => harness.s3.keys().filter((key) => key.startsWith(prefix))

test('a backup goes up as user part, manifest and blobs, and comes back', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const user = bytes(PART_SIZE + 1000)
  const { backupId, done, missingBlobs } = await harness.upload(accessToken, user, [BIBLE, SONGS])
  expect(done.status).toBe(200)
  expect(missingBlobs.sort()).toEqual([BackupHarness.hashOf(BIBLE), BackupHarness.hashOf(SONGS)].sort())

  const { backups, usage } = await list(accessToken)
  expect(backups).toEqual([expect.objectContaining({ id: backupId, sizeBytes: user.length + 50, blobCount: 2 })])
  expect(usage.usedBytes).toBe(user.length + 50 + BIBLE.length + SONGS.length)
  expect(usage.retentionDays).toBe(30)

  const download = await harness.request(`/backup/backups/${backupId}/download`, { method: 'POST' }, accessToken)
  const urls = (await download.json()) as {
    manifestUrl: string
    userPartUrl: string
    blobs: { hash: string; url: string }[]
    expiresAt: number
  }
  expect(new Uint8Array(await (await fetch(urls.userPartUrl)).arrayBuffer())).toEqual(user)
  for (const blob of urls.blobs) {
    const fetched = new Uint8Array(await (await fetch(blob.url)).arrayBuffer())
    expect(BackupHarness.hashOf(fetched)).toBe(blob.hash)
  }
  // Presigned for 15 minutes, never longer.
  for (const url of [urls.manifestUrl, urls.userPartUrl, ...urls.blobs.map((b) => b.url)]) {
    expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('900')
  }
  expect(Math.abs(urls.expiresAt - (Date.now() + 900_000))).toBeLessThan(5_000)
})

test('a second backup with unchanged resources uploads only its own parts', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.upload(accessToken, bytes(100), [BIBLE, SONGS])
  const before = harness.s3.requests.length
  const changedSongs = bytes(2100, 3)
  const second = await harness.upload(accessToken, bytes(120), [BIBLE, changedSongs])
  expect(second.done.status).toBe(200)
  expect(second.missingBlobs).toEqual([BackupHarness.hashOf(changedSongs)])
  // The Bible blob was never sent again.
  const sent = harness.s3.requests.slice(before).filter((r) => r.startsWith('PUT') && r.includes('/blobs/'))
  expect(sent).toHaveLength(1)
  expect(sent[0]).toContain(BackupHarness.hashOf(changedSongs))
  // Each blob is counted once.
  const { usage } = await list(accessToken)
  expect(usage.usedBytes).toBe(100 + 50 + 120 + 50 + BIBLE.length + SONGS.length + changedSongs.length)
})

test('blobs live under an unguessable account prefix, never listed, private', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  await harness.upload(accessToken, bytes(10), [BIBLE])
  const [key] = objectKeys('blobs/')
  // blobs/<64-hex account id>/<22-char random prefix>/<sha256>
  expect(key).toMatch(/^blobs\/[0-9a-f]{64}\/[A-Za-z0-9_-]{22}\/[0-9a-f]{64}$/)
  expect(key.endsWith(BackupHarness.hashOf(BIBLE))).toBe(true)
  // Two accounts with the same resource have different URLs for it.
  const bob = await harness.signIn(BOB)
  await harness.upload(bob.accessToken, bytes(10), [BIBLE])
  const keys = objectKeys('blobs/')
  expect(keys).toHaveLength(2)
  expect(keys[0].split('/')[2]).not.toBe(keys[1].split('/')[2])
})

test('every PUT URL is signed for its exact size; another size is refused', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const started = await harness.start(accessToken, 10, [BIBLE])
  const { backupId } = (await started.json()) as { backupId: string }
  const parts = await harness.json(`/backup/uploads/${backupId}/parts`, 'POST', { partNumbers: [1] }, accessToken)
  const files = await harness.json(`/backup/uploads/${backupId}/files`, 'POST', { files: ['manifest', BackupHarness.hashOf(BIBLE)] }, accessToken)
  const part = ((await parts.json()) as { parts: { url: string; sizeBytes: number }[] }).parts[0]
  expect(new URL(part.url).searchParams.get('X-Amz-SignedHeaders')).toContain('content-length')
  expect((await fetch(part.url, { method: 'PUT', body: bytes(part.sizeBytes + 5000) })).status).toBe(403)
  expect((await fetch(part.url, { method: 'PUT', body: bytes(part.sizeBytes) })).status).toBe(200)

  // Whole files: 5 minutes, signed for their size and If-None-Match: *.
  const urls = ((await files.json()) as {
    files: { name: string; url: string; sizeBytes: number; headers: Record<string, string> }[]
  }).files
  for (const { url, sizeBytes, headers } of urls) {
    const signed = new URL(url).searchParams
    expect(signed.get('X-Amz-Expires')).toBe('300')
    expect(signed.get('X-Amz-SignedHeaders')).toContain('if-none-match')
    expect((await fetch(url, { method: 'PUT', body: bytes(sizeBytes + 5000), headers })).status).toBe(403)
    expect((await fetch(url, { method: 'PUT', body: bytes(sizeBytes) })).status).toBe(403)
    expect((await fetch(url, { method: 'PUT', body: bytes(sizeBytes), headers })).status).toBe(200)
    // Never overwritten: a second PUT finds the object there.
    expect((await fetch(url, { method: 'PUT', body: bytes(sizeBytes, 4), headers })).status).toBe(412)
  }
  // A blob the upload doesn't send gets no URL.
  const other = await harness.json(`/backup/uploads/${backupId}/files`, 'POST', { files: ['f'.repeat(64)] }, accessToken)
  expect(other.status).toBe(400)
})

test('completion waits for missing files and refuses a size lie', async () => {
  const { accessToken } = await harness.signIn(ALICE)
  const started = await harness.start(accessToken, 10, [BIBLE])
  const { backupId } = (await started.json()) as { backupId: string }
  const early = await harness.request(`/backup/uploads/${backupId}/complete`, { method: 'POST' }, accessToken)
  expect(early.status).toBe(409)
  expect(((await early.json()) as { missing: string[] }).missing.sort()).toEqual(
    ['manifest', BackupHarness.hashOf(BIBLE)].sort()
  )

  // A store that ignored the signed length: 5000 bytes landed for the blob.
  const blobPrefix = JSON.parse(new TextDecoder().decode(
    [...harness.s3.objects].find(([key]) => key.endsWith('account.json'))?.[1]
  )).blobPrefix
  const accountId = [...harness.s3.objects.keys()].find((key) => key.endsWith('account.json'))?.split('/')[2]
  harness.s3.objects.set(`backups/blobs/${accountId}/${blobPrefix}/${BackupHarness.hashOf(BIBLE)}`, bytes(5000))
  harness.s3.modified.set(`backups/blobs/${accountId}/${blobPrefix}/${BackupHarness.hashOf(BIBLE)}`, Date.now())
  const files = await harness.json(`/backup/uploads/${backupId}/files`, 'POST', { files: ['manifest'] }, accessToken)
  const { files: [manifest] } = (await files.json()) as { files: { url: string }[] }
  await fetch(manifest.url, { method: 'PUT', body: bytes(50) })
  const lie = await harness.request(`/backup/uploads/${backupId}/complete`, { method: 'POST' }, accessToken)
  expect(lie.status).toBe(400)
  expect(((await lie.json()) as { code: string }).code).toBe('size_mismatch')
  // Nothing is left: no upload, no counted bytes, no objects of it.
  expect(harness.s3.uploads.size).toBe(0)
  expect((await list(accessToken)).usage.usedBytes).toBe(0)
  expect(objectKeys('backups/').filter((key) => key.includes(backupId))).toEqual([])
})

test('an account never reaches another account’s backups (no IDOR)', async () => {
  const alice = await harness.signIn(ALICE)
  const bob = await harness.signIn(BOB)
  const { backupId } = await harness.upload(alice.accessToken, bytes(100), [BIBLE])
  const started = await harness.start(alice.accessToken, 50)
  const pending = ((await started.json()) as { backupId: string }).backupId

  expect((await list(bob.accessToken)).backups).toEqual([])
  const attempts: [string, string, unknown][] = [
    ['POST', `/backup/backups/${backupId}/download`, undefined],
    ['DELETE', `/backup/backups/${backupId}`, undefined],
    ['POST', `/backup/uploads/${pending}/parts`, { partNumbers: [1] }],
    ['POST', `/backup/uploads/${pending}/files`, { files: ['manifest'] }],
    ['POST', `/backup/uploads/${pending}/complete`, undefined],
    ['DELETE', `/backup/uploads/${pending}`, undefined],
  ]
  for (const [method, path, body] of attempts) {
    const response = await harness.json(path, method, body ?? {}, bob.accessToken)
    expect(`${method} ${path} ${response.status}`).toBe(`${method} ${path} 404`)
  }
  expect((await list(alice.accessToken)).backups.map((b) => b.id)).toEqual([backupId])
  const accountKeys = harness.s3.keys().filter((key) => !key.startsWith('index/'))
  expect(accountKeys.join()).not.toContain('alice')
  expect(accountKeys.join()).not.toContain(ALICE.sub)
})

test('the free tier: size of one upload, in flight and per day', async () => {
  harness.env = backupEnv({ BACKUP_MAX_BYTES: '1000', BACKUP_UPLOADS_PER_DAY: '3' })
  const { accessToken } = await harness.signIn(ALICE)
  const code = async (response: Response) =>
    `${response.status} ${((await response.json()) as { code?: string }).code ?? ''}`
  expect(await code(await harness.start(accessToken, 960, [bytes(100)]))).toBe('413 too_large')
  expect(await code(await harness.start(accessToken, 0))).toBe('400 invalid_request')

  const first = (await (await harness.start(accessToken, 100)).json()) as { backupId: string }
  await harness.start(accessToken, 100)
  expect(await code(await harness.start(accessToken, 100))).toBe('409 upload_in_progress')
  await harness.request(`/backup/uploads/${first.backupId}`, { method: 'DELETE' }, accessToken)
  await harness.start(accessToken, 100)
  expect(await code(await harness.start(accessToken, 100))).toBe('429 daily_limit')
  expect(harness.s3.uploads.size).toBe(2)
})

test('deleting one backup, then the whole account', async () => {
  const { accessToken, refreshToken } = await harness.signIn(ALICE)
  const first = await harness.upload(accessToken, bytes(10), [BIBLE])
  await harness.upload(accessToken, bytes(20), [BIBLE])
  await harness.start(accessToken, 30)

  await harness.request(`/backup/backups/${first.backupId}`, { method: 'DELETE' }, accessToken)
  expect((await list(accessToken)).backups).toHaveLength(1)
  expect(objectKeys('blobs/')).toHaveLength(1)

  const deleted = await harness.request('/backup/account', { method: 'DELETE' }, accessToken)
  expect(await deleted.json()).toEqual({ deletedBackups: 1 })
  expect(objectKeys('backups/')).toEqual([])
  expect(objectKeys('blobs/')).toEqual([])
  expect(harness.s3.uploads.size).toBe(0)
  // Nothing is left but the tombstone: not even the record.
  expect(harness.s3.keys().filter((key) => !key.startsWith('index/'))).toEqual([
    expect.stringMatching(/^tombstones\/[0-9a-f]{64}\.json$/),
  ])
  expect((await harness.request('/backup/backups', {}, accessToken)).status).toBe(401)
  const refresh = await harness.json('/backup/session/refresh', 'POST', { refreshToken })
  expect(refresh.status).toBe(401)
})
