import { type APIRequestContext, expect, test } from '@playwright/test'
import JSZip from 'jszip'

import { ExtraServer } from './helpers/extra-server'
import { FakeS3 } from './helpers/fake-s3'
import { checkSource, openSongXml } from './helpers/song-folder-source'

/**
 * Resurse Creștine, like every built-in song file, is read from the
 * `song-sources` GitHub release (docs/managed-song-sources.md), stood in for
 * by an S3 stand-in at /song-sources. The server refuses a file that is
 * damaged (a ZIP entry's CRC-32 differs) or whose manifest's checksum is not
 * the `.sha256` published next to it.
 */

const SOURCE = 'resurse-crestine'
const FILE = `/song-sources/${SOURCE}.chsongs`
const ts = Date.now()

let s3: FakeS3
let server: ExtraServer
let api: APIRequestContext

/** A Resurse Creștine song file with these songs and this checksum. */
async function songFile(checksum: string, lines: string[]): Promise<Buffer> {
  const zip = new JSZip()
  const songs = lines.map((line, index) => {
    const title = `RC Release ${ts} ${index}`
    const path = `${title}.opensong`
    zip.file(path, openSongXml(title, [line]))
    return {
      id: `rc-${ts}-${index}`,
      title,
      path,
      hash: `${checksum}-${index}`,
    }
  })
  zip.file(
    'manifest.json',
    JSON.stringify({
      format: 'church-hub-song-bundle',
      version: 2,
      name: 'Resurse Creștine',
      categoryName: 'Resurse Crestine',
      checksum,
      updatedAt: new Date().toISOString(),
      songs,
    }),
  )
  return zip.generateAsync({ type: 'nodebuffer' })
}

/** Publishes the file and its `.sha256`, as the archive workflow does. */
function publish(archive: Buffer, published: string) {
  s3.objects.set(FILE, archive)
  s3.objects.set(`${FILE}.sha256`, Buffer.from(`${published}\n`))
}

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.beforeAll(async () => {
  test.setTimeout(300_000)
  s3 = new FakeS3()
  await s3.start()
  server = new ExtraServer()
  await server.start({
    CHURCH_HUB_SONG_SOURCES_RELEASE_URL: `${s3.endpoint}/song-sources`,
    CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
    CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
  })
  api = await server.adminRequest()
})

test.afterAll(async () => {
  await api?.dispose()
  await server?.dispose()
  await s3?.stop()
})

test('the app reads Resurse Creștine from the release', async () => {
  const archive = await songFile(`good-${ts}`, ['first line', 'second line'])
  publish(archive, `good-${ts}`)

  const checksum = await api.get(`/api/song-sources/${SOURCE}/checksum`)
  expect((await checksum.json()).data.checksum).toBe(`good-${ts}`)

  const download = await api.get(`/api/song-sources/${SOURCE}/archive`)
  expect(download.ok()).toBe(true)
  expect(Buffer.from(await download.body())).toEqual(archive)

  const check = await checkSource(api, SOURCE)
  expect(check.newCount + check.imported).toBe(2)

  // The bucket's endpoint is gone with the bucket: a 404, not the client page.
  const managed = await api.get(`/api/song-sources/${SOURCE}/managed`)
  expect(managed.status()).toBe(404)
  expect(managed.headers()['content-type']).toContain('application/json')
})

test('a song file whose checksum is not the published one is refused', async () => {
  // The upload caught half-way: the new .sha256, the old file.
  publish(await songFile(`old-${ts}`, ['old line']), `new-${ts}`)

  const download = await api.get(`/api/song-sources/${SOURCE}/archive`)
  expect(download.status()).toBe(502)
  expect((await download.json()).error).toContain('does not match its checksum')

  const check = (await checkSource(api, SOURCE)) as { error?: string }
  expect(check.error).toContain('does not match its checksum')
})

test('a damaged song file is refused', async () => {
  const line = `a line to damage ${ts}`
  const archive = await songFile(`damaged-${ts}`, [line])
  // JSZip stores entries uncompressed by default: flip a byte of the lyrics.
  const at = archive.indexOf(line)
  expect(at).toBeGreaterThan(0)
  archive[at] = (archive[at] as number) ^ 0x01
  publish(archive, `damaged-${ts}`)

  const download = await api.get(`/api/song-sources/${SOURCE}/archive`)
  expect(download.status()).toBe(502)
  expect((await download.json()).error).toContain('CRC32')
})
