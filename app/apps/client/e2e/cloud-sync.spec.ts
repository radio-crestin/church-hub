import { gunzipSync } from 'node:zlib'
import { type APIRequestContext, expect, test } from '@playwright/test'

import { FakeS3 } from './helpers/fake-s3'
import { SYNC_BUCKET, SyncService } from './helpers/sync-service'

/**
 * Cloud sync (T-171): churchhub-backend's sync service, self-hosted on Bun
 * against an S3 stand-in, with this server as the church PC and a "phone"
 * calling the service with its own device token. Reads go straight to the
 * bucket; every write goes through the service, which checks it.
 */

interface Ref {
  seq: number
  key: string
}
interface Head {
  seq: number
  snapshot: Ref | null
  segments: Ref[]
}
interface Change {
  type: string
  uuid: string
  op: 'upsert' | 'delete'
  version: number
  data?: { uuid: string; title?: string; updatedAt: number }
}

const s3 = new FakeS3()
const service = new SyncService()

async function readHead(readUrl: string): Promise<Head> {
  const response = await fetch(`${readUrl}/head.json`)
  expect(response.status).toBe(200)
  return (await response.json()) as Head
}

async function readGzip<T>(url: string): Promise<T> {
  const response = await fetch(url)
  expect(response.status).toBe(200)
  return JSON.parse(
    gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8'),
  ) as T
}

/** Every change published after the head's snapshot, oldest first. */
async function publishedChanges(readUrl: string): Promise<Change[][]> {
  const head = await readHead(readUrl)
  const segments = []
  for (const ref of head.segments) {
    segments.push(
      (await readGzip<{ changes: Change[] }>(`${readUrl}/${ref.key}`)).changes,
    )
  }
  return segments
}

/** Runs sync cycles until `check` holds (one may already be running). */
async function syncUntil(
  request: APIRequestContext,
  check: () => Promise<boolean>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await request.post('/api/sync/now')
        return check()
      },
      { timeout: 30_000, intervals: [300, 500, 1000] },
    )
    .toBe(true)
}

async function songTitle(request: APIRequestContext, id: number) {
  const res = await request.get(`/api/songs/${id}`)
  return (await res.json()).data.title as string
}

function changesUrl(churchId: string): string {
  return `${service.url}/sync/churches/${churchId}/changes`
}

async function phoneWrite(churchId: string, token: string, changes: unknown) {
  const response = await fetch(changesUrl(churchId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ changes }),
  })
  return { status: response.status, body: await response.json() }
}

test.describe
  .serial('Cloud sync', () => {
    test.setTimeout(120_000)

    let churchId = ''
    let readUrl = ''
    let songId = 0
    let songUuid = ''
    let phone = { deviceId: '', token: '' }

    test.beforeAll(async () => {
      s3.signedWritesOnly = true
      await s3.start()
      // Snapshots only when a test asks for one: the first upload of the
      // suite's library is ~50 segments, and the checks read the segments.
      await service.start(s3.endpoint, { SYNC_COMPACT_AFTER: '100000' })
    })

    test.afterAll(async ({ request }) => {
      await request.delete('/api/sync/cloud')
      await service.dispose()
      await s3.stop()
    })

    test('the PC registers as a guest church and publishes each edit as a small segment', async ({
      request,
    }) => {
      const connected = await request.post('/api/sync/cloud', {
        data: { serviceUrl: service.url },
      })
      expect(connected.status()).toBe(200)
      ;({ churchId, readUrl } = (await connected.json()).data)
      // churches/<churchId>-<256-bit secret>: knowing the path is the read right.
      expect(readUrl).toMatch(
        new RegExp(
          `^${s3.endpoint}/${SYNC_BUCKET}/churches/${churchId}-[A-Za-z0-9_-]{43}$`,
        ),
      )

      const status = (await (await request.get('/api/sync/status')).json()).data
      expect(status).toMatchObject({
        enabled: true,
        transport: 'cloud',
        connected: true,
        cloud: { churchId },
      })

      const title = `E2E Cloud ${Date.now()}`
      const created = await request.post('/api/songs', {
        data: {
          title,
          slides: [{ content: 'one', sortOrder: 0, label: 'V1' }],
        },
      })
      songId = (await created.json()).data.id
      await syncUntil(request, async () => {
        const segments = await publishedChanges(readUrl)
        const change = segments.flat().find((c) => c.data?.title === title)
        if (change) songUuid = change.uuid
        return change !== undefined
      })

      const renamed = `${title} renamed`
      await request.post('/api/songs', { data: { id: songId, title: renamed } })
      await syncUntil(request, async () => {
        const last = (await publishedChanges(readUrl)).at(-1) ?? []
        // Only the diff travels: the renamed song, not the library.
        return (
          last.length === 1 &&
          last[0].uuid === songUuid &&
          last[0].data?.title === renamed
        )
      })
    })

    test('anyone reads the church path; nobody lists the bucket or writes to it anonymously', async () => {
      const head = await fetch(`${readUrl}/head.json`)
      expect(head.status).toBe(200)
      const etag = head.headers.get('etag') ?? ''
      const unchanged = await fetch(`${readUrl}/head.json`, {
        headers: { 'If-None-Match': etag },
      })
      expect(unchanged.status).toBe(304)

      const listing = await fetch(
        `${s3.endpoint}/${SYNC_BUCKET}?list-type=2&prefix=churches/`,
      )
      expect(listing.status).toBe(403)
      const anonymousWrite = await fetch(`${readUrl}/head.json`, {
        method: 'PUT',
        body: '{}',
      })
      expect(anonymousWrite.status).toBe(403)
    })

    test('the church’s state sits in the bucket sealed: nothing in it reads without the secret', async () => {
      // No database: devices, users and versions live in one object, here
      // in the public bucket itself, encrypted with the service's secret.
      const state = await fetch(
        `${s3.endpoint}/${SYNC_BUCKET}/sync-state/${churchId}.bin`,
      )
      expect(state.status).toBe(200)
      const bytes = Buffer.from(await state.arrayBuffer())
      expect(bytes.length).toBeGreaterThan(100)
      expect(() => gunzipSync(bytes)).toThrow()
      const text = bytes.toString('latin1')
      for (const plain of [churchId, songUuid, 'tokenHash', 'versions']) {
        expect(text).not.toContain(plain)
      }
    })

    test('a phone writes with its user’s permissions; the PC applies its edit', async ({
      request,
    }) => {
      const user = await request.post('/api/users', {
        data: {
          name: `E2E Cloud Editor ${Date.now()}`,
          permissions: ['songs.view', 'songs.edit'],
        },
      })
      const userId = (await user.json()).data.user.id as number
      const device = await request.post('/api/sync/cloud/devices', {
        data: { userId, name: 'E2E phone' },
      })
      expect(device.status()).toBe(201)
      const minted = (await device.json()).data
      expect(minted).toMatchObject({ churchId, readUrl })
      phone = { deviceId: minted.deviceId, token: minted.token }

      const latest = (await publishedChanges(readUrl))
        .flat()
        .filter((c) => c.uuid === songUuid)
        .at(-1) as Change
      const phoneTitle = `${latest.data?.title} (phone)`
      const edit = {
        type: 'song',
        uuid: songUuid,
        op: 'upsert',
        baseVersion: latest.version,
        data: {
          ...latest.data,
          title: phoneTitle,
          updatedAt: Math.floor(Date.now() / 1000) + 5,
        },
      }
      const accepted = await phoneWrite(churchId, phone.token, [edit])
      expect(accepted.status).toBe(200)
      expect(accepted.body.versions).toEqual([
        { type: 'song', uuid: songUuid, version: accepted.body.seq },
      ])

      // Compacted before the PC pulls it: the PC catches up from the
      // snapshot (any device's token may ask for one).
      const compacted = await fetch(
        `${service.url}/sync/churches/${churchId}/compact`,
        { method: 'POST', headers: { Authorization: `Bearer ${phone.token}` } },
      )
      expect((await compacted.json()).snapshotSeq).toBe(accepted.body.seq)
      expect((await readHead(readUrl)).segments).toEqual([])

      await syncUntil(
        request,
        async () => (await songTitle(request, songId)) === phoneTitle,
      )

      // Not allowed: this user may edit songs, not create them.
      const created = await phoneWrite(churchId, phone.token, [
        {
          type: 'song',
          uuid: `e2e${Date.now()}`,
          op: 'upsert',
          baseVersion: 0,
          data: { uuid: `e2e${Date.now()}`, title: 'Nope', updatedAt: 1 },
        },
      ])
      expect(created.status).toBe(403)
      expect(created.body.code).toBe('forbidden')
      expect(created.body.rejected[0].permission).toBe('songs.create')

      // Made on an older version: someone changed the row first.
      const stale = await phoneWrite(churchId, phone.token, [edit])
      expect(stale.status).toBe(409)
      expect(stale.body.conflicts).toEqual([
        { type: 'song', uuid: songUuid, version: accepted.body.seq },
      ])
    })

    test('revoking the phone moves the church to a new secret path, and the PC follows', async ({
      request,
    }) => {
      const oldReadUrl = readUrl
      const revoked = await request.delete(
        `/api/sync/cloud/devices/${phone.deviceId}`,
      )
      expect(revoked.status()).toBe(200)
      readUrl = (await revoked.json()).data.readUrl
      expect(readUrl).not.toBe(oldReadUrl)

      expect((await fetch(`${oldReadUrl}/head.json`)).status).toBe(404)
      const refused = await phoneWrite(churchId, phone.token, [
        {
          type: 'song',
          uuid: songUuid,
          op: 'delete',
          baseVersion: 0,
          deletedAt: 1,
        },
      ])
      expect(refused.status).toBe(401)

      // The new path starts from a snapshot of the whole library.
      const head = await readHead(readUrl)
      expect(head.snapshot).not.toBeNull()
      const snapshot = await readGzip<{
        songs: { uuid: string; title: string }[]
      }>(`${readUrl}/${head.snapshot?.key}`)
      expect(snapshot.songs.find((s) => s.uuid === songUuid)?.title).toBe(
        await songTitle(request, songId),
      )

      const again = `E2E Cloud after rotation ${Date.now()}`
      await request.post('/api/songs', { data: { id: songId, title: again } })
      await syncUntil(request, async () =>
        (await publishedChanges(readUrl))
          .flat()
          .some((c) => c.uuid === songUuid && c.data?.title === again),
      )
    })

    test('a deleted song is published as a delete', async ({ request }) => {
      expect((await request.delete(`/api/songs/${songId}`)).ok()).toBe(true)
      await syncUntil(request, async () =>
        (await publishedChanges(readUrl))
          .flat()
          .some((c) => c.uuid === songUuid && c.op === 'delete'),
      )
    })

    test('every cloud sync endpoint is in the OpenAPI specs', async ({
      request,
    }) => {
      const app = await (await request.get('/api/openapi.json')).json()
      for (const path of [
        '/api/sync/cloud',
        '/api/sync/cloud/devices',
        '/api/sync/cloud/devices/{deviceId}',
      ]) {
        expect(app.paths, path).toHaveProperty([path])
      }

      const spec = await (
        await fetch(`${service.url}/sync/openapi.json`)
      ).json()
      for (const path of [
        '/sync/churches',
        '/sync/churches/{churchId}/path',
        '/sync/churches/{churchId}/access',
        '/sync/churches/{churchId}/devices',
        '/sync/churches/{churchId}/devices/{deviceId}',
        '/sync/churches/{churchId}/changes',
        '/sync/churches/{churchId}/compact',
        '/sync/churches/{churchId}/rotate',
      ]) {
        expect(spec.paths, path).toHaveProperty([path])
      }
    })
  })
