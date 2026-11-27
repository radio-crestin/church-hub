import { gzipSync } from 'node:zlib'
import { sha256Hex } from '@church-hub/song-formats'
import { expect, test } from '@playwright/test'

import { takeCuratorTicket } from './helpers/curated-library'
import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import { SyncService } from './helpers/sync-service'

/**
 * What the sync service refuses on the Church Hub Library (T-177): songs
 * that are not OpenSong, too many submissions from one address, anyone but
 * a curator, a shard that is not its hash, a manifest of another library or
 * built on an old one, and a church's own library without its token.
 */

const CURATOR = { sub: 'google-curator-2', email: 'curator@example.com' }
const STRANGER = { sub: 'google-stranger-2', email: 'stranger@example.com' }
const SONG =
  '<?xml version="1.0"?><song><title>Guarded</title><lyrics>[V1]\n Words</lyrics></song>'

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()
/** A church's own library (a 16-character church id, then its folder). */
const CHURCH_LIBRARY = 'AAAAAAAAAAAAAAAA-abc'
const library = () => `${service.url}/sync/libraries/church-hub`

function submit(body: unknown) {
  return fetch(`${library()}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

test.describe
  .serial('Church Hub Library guards', () => {
    let ticket = ''

    test.beforeAll(async () => {
      await s3.start()
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        LIBRARY_CURATORS: CURATOR.email,
        LIBRARY_RATE_LIMIT_PER_MINUTE: '4',
      })
    })

    test.afterAll(async ({ request }) => {
      await request.post('/api/sync/cloud/owner/sign-out')
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('a submission must be an OpenSong song, and is rate-limited', async () => {
      expect(
        (await submit({ songs: [{ title: 'No song', xml: 'hello' }] })).status,
      ).toBe(400)
      const tooMany = Array.from({ length: 501 }, () => ({
        title: 'Guarded',
        xml: SONG,
      }))
      expect((await submit({ songs: tooMany })).status).toBe(400)
      expect(
        (await submit({ songs: [{ title: 'Guarded', xml: SONG }] })).status,
      ).toBe(201)
      expect(
        (await submit({ songs: [{ title: 'Guarded', xml: SONG }] })).status,
      ).toBe(201)
      const limited = await submit({ songs: [{ title: 'Guarded', xml: SONG }] })
      expect(limited.status).toBe(429)
      expect((await limited.json()).code).toBe('rate_limited')
    })

    test('only a curator sees the queue', async ({ request }) => {
      expect((await fetch(`${library()}/submissions`)).status).toBe(401)
      google.account = STRANGER
      const stranger = await takeCuratorTicket(request)
      const refused = await fetch(`${library()}/submissions`, {
        headers: { Authorization: `Bearer ${stranger}` },
      })
      expect(refused.status).toBe(403)
      expect((await refused.json()).code).toBe('not_curator')

      google.account = CURATOR
      ticket = await takeCuratorTicket(request)
      const queue = await fetch(`${library()}/submissions`, {
        headers: { Authorization: `Bearer ${ticket}` },
      })
      expect(queue.status).toBe(200)
      expect((await queue.json()).submissions).toHaveLength(2)
    })

    test('a shard must be its hash; storing it twice changes nothing', async () => {
      const json = Buffer.from(
        JSON.stringify({
          format: 'church-hub-song-shard',
          version: 1,
          songs: [],
        }),
      )
      const hash = await sha256Hex(new Uint8Array(json))
      const put = (name: string) =>
        fetch(`${library()}/shards/${name}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${ticket}` },
          body: gzipSync(json),
        })
      expect((await put('0'.repeat(64))).status).toBe(400)
      expect((await put(hash)).status).toBe(200)
      expect((await put(hash)).status).toBe(200)
    })

    test('a manifest of another library, or built on an old one, is refused', async () => {
      const publish = (sourceId: string, body: unknown, auth = ticket) =>
        fetch(`${service.url}/sync/libraries/${sourceId}/manifest`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth}`,
          },
          body: JSON.stringify(body),
        })
      const manifest = {
        format: 'church-hub-song-bundle',
        version: 3,
        sourceId: 'church-hub',
        checksum: 'empty',
        songs: [],
        shards: [],
      }
      const other = await publish('church-hub', {
        baseChecksum: null,
        manifest: { ...manifest, sourceId: 'someone-else' },
      })
      expect(other.status).toBe(400)

      const stale = await publish('church-hub', {
        baseChecksum: 'an-old-checksum',
        manifest,
      })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toMatchObject({
        code: 'library_changed',
        checksum: null,
      })

      const churchLibrary = await publish(CHURCH_LIBRARY, {
        baseChecksum: null,
        manifest: { ...manifest, sourceId: CHURCH_LIBRARY },
      })
      expect(churchLibrary.status).toBe(401)

      expect(
        (await publish('church-hub', { baseChecksum: null, manifest })).status,
      ).toBe(200)
    })
  })
