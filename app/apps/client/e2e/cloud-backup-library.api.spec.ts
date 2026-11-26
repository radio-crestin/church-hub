import { gunzipSync } from 'node:zlib'
import { type APIRequestContext, expect, test } from '@playwright/test'
import JSZip from 'jszip'

import { ExtraServer } from './helpers/extra-server'
import { FakeGoogle } from './helpers/fake-google'
import { FakeS3 } from './helpers/fake-s3'
import {
  addLinkSource,
  checkSource,
  openSongXml,
  publishSongFolder,
} from './helpers/song-folder-source'
import { SyncService } from './helpers/sync-service'

/**
 * Which songs a cloud backup may store unencrypted: only those whose
 * provenance checks out, slides identical to what a built-in public source
 * (Resurse Creștine, stood in for) publishes. A church song put in that
 * source's category, a library song changed here (even without a manual
 * edit mark) and a song from a private link all stay in the encrypted part.
 */

const tag = String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])
const RC = 'resurse-crestine'
const BUCKET = 'church-hub-backups'
const SHARED = `RC Shared ${tag}`
const EDITED = `RC Edited ${tag}`
const SHARED_LINE = `${tag} public line of the shared song`
const EDITED_LINE = `${tag} public line of the edited song`
const LOCAL_LINE = `${tag} a line this church added`
const CHURCH_LINE = `${tag} our own song in their category`
const PRIVATE_LINE = `${tag} a song from a private link`

const s3 = new FakeS3()
const google = new FakeGoogle()
const service = new SyncService()
const server = new ExtraServer()
let api: APIRequestContext

/** A Resurse Creștine release file with these songs, on the stand-in. */
async function publishResurseCrestine() {
  const zip = new JSZip()
  const songs = [
    [SHARED, SHARED_LINE],
    [EDITED, EDITED_LINE],
  ].map(([title, line], index) => {
    const path = `${title}.opensong`
    zip.file(path, openSongXml(title, [line]))
    return { id: `rc-${index}`, title, path, hash: `${tag}-${index}` }
  })
  zip.file(
    'manifest.json',
    JSON.stringify({
      format: 'church-hub-song-bundle',
      version: 2,
      name: 'Resurse Creștine',
      categoryName: 'Resurse Crestine',
      checksum: tag,
      updatedAt: new Date().toISOString(),
      songs,
    }),
  )
  s3.objects.set(
    `/song-sources/${RC}.chsongs`,
    await zip.generateAsync({ type: 'nodebuffer' }),
  )
  s3.objects.set(
    `/song-sources/${RC}.chsongs.sha256`,
    Buffer.from(`${tag}  ${RC}.chsongs\n`),
  )
}

async function songId(title: string): Promise<number> {
  const res = await api.get(`/api/songs/search?q=${encodeURIComponent(title)}`)
  const hit = ((await res.json()).data as { id: number; title: string }[]).find(
    (song) => song.title === title,
  )
  expect(hit, title).toBeTruthy()
  return hit?.id as number
}

/** Every song_slides row in the backup's plaintext blobs: song id and content. */
function slidesInBlobs() {
  const rows: { songId: number; content: string }[] = []
  for (const [key, body] of s3.objects) {
    if (!key.startsWith(`/${BUCKET}/blobs/`)) continue
    let columns: string[] = []
    let table = ''
    for (const line of gunzipSync(body)
      .toString('utf8')
      .trim()
      .split('\n')
      .slice(1)) {
      const value = JSON.parse(line)
      if (!Array.isArray(value)) {
        ;({ table, columns } = value)
        continue
      }
      if (table !== 'song_slides') continue
      rows.push({
        songId: value[columns.indexOf('song_id')],
        content: value[columns.indexOf('content')],
      })
    }
  }
  return rows
}

test.describe
  .serial('Cloud backup: what may stay unencrypted', () => {
    test.setTimeout(300_000)

    test.beforeAll(async () => {
      test.setTimeout(300_000)
      await s3.start()
      await google.start()
      await service.start(s3.endpoint, {
        ...google.serviceEnv,
        BACKUP_SECRET: 'e2e-backup-secret',
        BACKUP_KEY_SECRET: 'e2e-backup-key-secret',
        BACKUP_S3_ENDPOINT: s3.endpoint,
        BACKUP_S3_BUCKET: BUCKET,
        BACKUP_S3_REGION: 'us-east-1',
        BACKUP_S3_ACCESS_KEY_ID: 'e2e-backup-access-key',
        BACKUP_S3_SECRET_ACCESS_KEY: 'e2e-backup-secret-key',
      })
      await publishResurseCrestine()
      await server.start({
        CHURCH_HUB_SONG_SOURCES_URL: `${s3.endpoint}/songs-bucket`,
        CHURCH_HUB_SONG_SOURCES_RELEASE_URL: `${s3.endpoint}/song-sources`,
        CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
        CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
        CHURCH_HUB_SYNC_URL: service.url,
        CHURCH_HUB_BACKUP_URL: service.url,
        CHURCH_HUB_BACKUP_PUBLIC_SOURCES: RC,
      })
      api = await server.adminRequest()
    })

    test.afterAll(async () => {
      await api?.dispose()
      await server.dispose()
      await service.dispose()
      await google.stop()
      await s3.stop()
    })

    test('only untouched public-source songs go into plaintext blobs', async () => {
      // The library: both public songs, imported from the source.
      const imported = await checkSource(api, RC)
      expect(imported.imported).toBe(2)
      const shared = await songId(SHARED)
      const edited = await songId(EDITED)

      // A local change to one, without a manual edit mark: a slide added.
      const added = await api.post('/api/song-slides', {
        data: { songId: edited, content: LOCAL_LINE, type: 'verse' },
      })
      expect(added.ok()).toBe(true)

      // A church song put in the public source's category.
      const categories = (await (await api.get('/api/categories')).json())
        .data as {
        id: number
        name: string
      }[]
      const rcCategory = categories.find((c) => c.name === 'Resurse Crestine')
      expect(rcCategory).toBeTruthy()
      const church = await api.post('/api/songs', {
        data: {
          title: `Our song ${tag}`,
          categoryId: rcCategory?.id,
          slides: [{ content: CHURCH_LINE, type: 'verse' }],
        },
      })
      expect(church.ok()).toBe(true)
      const churchId = (await church.json()).data.id as number

      // A song from a private link subscription.
      const link = publishSongFolder(
        s3,
        `/private-folder/${tag}`,
        `Private ${tag}`,
        [
          {
            id: 'p1',
            title: `Private song ${tag}`,
            xml: openSongXml(`Private song ${tag}`, [PRIVATE_LINE]),
          },
        ],
        tag,
      )
      const linkSource = await addLinkSource(api, link)
      expect((await checkSource(api, linkSource)).imported).toBe(1)
      const privateId = await songId(`Private song ${tag}`)

      // Sign in to Church Hub Cloud (Google stood in for) and back up.
      google.account = { sub: `google-${tag}`, email: `${tag}@example.com` }
      const started = await api.post('/api/backup/cloud/sign-in', { data: {} })
      await fetch((await started.json()).data.authUrl)
      const backup = await api.post('/api/backup/cloud/backups', {
        data: {},
        timeout: 180_000,
      })
      expect(backup.status()).toBe(200)

      const rows = slidesInBlobs()
      const songs = new Set(rows.map((row) => row.songId))
      expect(songs.has(shared)).toBe(true)
      for (const id of [edited, churchId, privateId])
        expect(songs.has(id)).toBe(false)
      const contents = rows.map((row) => row.content).join('\n')
      expect(contents).toContain(SHARED_LINE)
      for (const line of [EDITED_LINE, LOCAL_LINE, CHURCH_LINE, PRIVATE_LINE]) {
        expect(contents).not.toContain(line)
      }
    })
  })
