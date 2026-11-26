import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import JSZip from 'jszip'

import { setAppLanguage } from './helpers/app-language'
import { ExtraServer } from './helpers/extra-server'
import { FakeS3 } from './helpers/fake-s3'
import { checkSource, openSongXml } from './helpers/song-folder-source'
import { makeTempDir, removeTempDir } from './helpers/temp-dir'

/**
 * Resurse Creștine is Church Hub's managed song source: the workflow's
 * publisher (apps/server/scripts/publish-managed-source.ts) puts each new
 * build in our bucket, a versioned archive plus latest.json, and the app
 * reads it from there, checked against the manifest, falling back to the
 * GitHub release while the bucket has no copy. One stand-in S3 plays both
 * the bucket (/songs-bucket) and the release (/song-sources).
 */

const SOURCE = 'resurse-crestine'
const BUCKET = 'songs-bucket'
const FOLDER = `/${BUCKET}/song-sources/${SOURCE}`
const SERVER_DIR = fileURLToPath(new URL('../../server', import.meta.url))
const ts = Date.now()

let s3: FakeS3
let server: ExtraServer
let api: APIRequestContext
let context: BrowserContext
let page: Page
const workDir = makeTempDir('managed-source-')

interface Build {
  version: string
  checksum: string
  archive: Buffer
}

/** A Resurse Creștine build: a `.chsongs` with these songs, built at `day`. */
async function buildArchive(day: string, titles: string[]): Promise<Build> {
  const checksum = createHash('sha256')
    .update(day + titles.join())
    .digest('hex')
    .slice(0, 16)
  const zip = new JSZip()
  const songs = titles.map((title, index) => {
    const path = `${title}.opensong`
    zip.file(path, openSongXml(title, [`${title} line ${index}`]))
    return { id: `rc-${index}-${checksum}`, title, path, hash: checksum }
  })
  zip.file(
    'manifest.json',
    JSON.stringify({
      format: 'church-hub-song-bundle',
      version: 2,
      name: 'Resurse Creștine',
      categoryName: 'Resurse Crestine',
      checksum,
      updatedAt: `${day}T03:17:00.000Z`,
      songs,
    }),
  )
  const archive = await zip.generateAsync({ type: 'nodebuffer' })
  return {
    version: `${day.replaceAll('-', '.')}-${checksum.slice(0, 6)}`,
    checksum,
    archive,
  }
}

/**
 * Runs the workflow's publish step on a build, against the stand-in bucket
 * (asynchronously: the stand-in answers from this process).
 */
async function publish(build: Build): Promise<string> {
  const dir = join(workDir, build.version)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${SOURCE}.chsongs`), build.archive)
  writeFileSync(join(dir, `${SOURCE}-opensong.zip`), build.archive)
  const { stdout } = await promisify(execFile)(
    process.platform === 'win32' ? 'bun.exe' : 'bun',
    ['scripts/publish-managed-source.ts', dir, SOURCE],
    {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        SONG_SOURCES_S3_ENDPOINT: s3.endpoint,
        SONG_SOURCES_S3_BUCKET: BUCKET,
        SONG_SOURCES_S3_ACCESS_KEY_ID: 'e2e-key',
        SONG_SOURCES_S3_SECRET_ACCESS_KEY: 'e2e-secret',
      },
      timeout: 60_000,
    },
  )
  return stdout
}

const latest = () => JSON.parse(s3.text(`${FOLDER}/latest.json`) ?? 'null')
const puts = () => s3.requests.filter((r) => r.startsWith('PUT ')).length
const releaseReads = () =>
  s3.requests.filter((r) => r.startsWith('GET /song-sources/')).length

/** Song discovery, on Resurse Creștine's row. */
async function managedNote() {
  await page.goto(`/songs/discover?source=${SOURCE}`)
  return page.getByTestId(`managed-source-${SOURCE}`)
}

const builds: Build[] = []

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000)
  s3 = new FakeS3()
  await s3.start()
  server = new ExtraServer()
  await server.start({
    CHURCH_HUB_SONG_SOURCES_URL: `${s3.endpoint}/${BUCKET}`,
    CHURCH_HUB_SONG_SOURCES_RELEASE_URL: `${s3.endpoint}/song-sources`,
    CHURCH_HUB_ALLOW_LOOPBACK_LINKS: 'true',
    CHURCH_HUB_SONG_UPDATES_AT_START: 'false',
  })
  api = await server.adminRequest()
  context = await browser.newContext({
    baseURL: server.baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const users = (await (
    await context.request.get('/api/auth/local-users')
  ).json()) as { data: { id: number; isSuperAdmin: boolean }[] }
  const admin = users.data.find((u) => u.isSuperAdmin)
  await context.request.post('/api/auth/login', { data: { userId: admin?.id } })
  page = await context.newPage()
  await setAppLanguage(page, 'en')
})

test.afterAll(async () => {
  await context?.close()
  await api?.dispose()
  await server?.dispose()
  await s3?.stop()
  removeTempDir(workDir)
})

test('the publisher puts a build in the bucket once, versioned', async () => {
  const build = await buildArchive('2026-11-20', [`RC Song A ${ts}`])
  builds.push(build)
  await publish(build)

  const manifest = latest()
  const archivePath = `${build.version}/${SOURCE}.chsongs`
  expect(manifest).toMatchObject({
    format: 'church-hub-managed-source',
    formatVersion: 1,
    sourceId: SOURCE,
    name: 'Resurse Creștine',
    version: build.version,
    checksum: build.checksum,
    songCount: 1,
    builtAt: '2026-11-20T03:17:00.000Z',
    versions: [build.version],
  })
  expect(manifest.files).toEqual([
    {
      name: `${SOURCE}.chsongs`,
      path: archivePath,
      size: build.archive.length,
      sha256: createHash('sha256').update(build.archive).digest('hex'),
    },
    expect.objectContaining({
      name: `${SOURCE}-opensong.zip`,
      path: `${build.version}/${SOURCE}-opensong.zip`,
    }),
  ])
  expect(s3.objects.get(`${FOLDER}/${archivePath}`)).toEqual(build.archive)
  expect(s3.cacheControl.get(`${FOLDER}/${archivePath}`)).toBe(
    'public, max-age=31536000, immutable',
  )
  expect(s3.cacheControl.get(`${FOLDER}/latest.json`)).toBe(
    'public, max-age=300',
  )

  // The same songs again: nothing is uploaded.
  const before = puts()
  expect(await publish(build)).toContain('Unchanged')
  expect(puts()).toBe(before)
})

test('the bucket keeps the newest five versions', async () => {
  for (const day of ['21', '22', '23', '24', '25']) {
    const build = await buildArchive(`2026-11-${day}`, [
      `RC Song A ${ts}`,
      `RC Song B ${ts}`,
    ])
    builds.push(build)
    await publish(build)
  }
  const [oldest, ...kept] = builds
  expect(latest().versions).toEqual(
    kept.map((build) => build.version).reverse(),
  )
  expect(s3.objects.has(`${FOLDER}/${oldest?.version}/${SOURCE}.chsongs`)).toBe(
    false,
  )
  expect(
    s3.objects.has(`${FOLDER}/${oldest?.version}/${SOURCE}-opensong.zip`),
  ).toBe(false)
  for (const build of kept) {
    expect(s3.objects.has(`${FOLDER}/${build.version}/${SOURCE}.chsongs`)).toBe(
      true,
    )
  }
})

test('the app reads the managed copy and shows it as ours, with its version', async () => {
  const current = builds.at(-1) as Build
  const releaseBefore = releaseReads()

  const checksum = await api.get(`/api/song-sources/${SOURCE}/checksum`)
  expect((await checksum.json()).data.checksum).toBe(current.checksum)

  const managed = await api.get(`/api/song-sources/${SOURCE}/managed`)
  expect((await managed.json()).data).toEqual({
    version: current.version,
    checksum: current.checksum,
    songCount: 2,
    builtAt: '2026-11-25T03:17:00.000Z',
  })

  const archive = await api.get(`/api/song-sources/${SOURCE}/archive`)
  expect(archive.ok()).toBe(true)
  expect(Buffer.from(await archive.body())).toEqual(current.archive)

  // A check reads the songs from the bucket too.
  const check = await checkSource(api, SOURCE)
  expect(check.newCount + check.imported).toBe(2)
  expect(releaseReads()).toBe(releaseBefore)

  await expect(await managedNote()).toHaveText(
    `Managed by Church Hub · version ${current.version}`,
  )
})

test('a song file that does not match its checksum is refused', async () => {
  const current = builds.at(-1) as Build
  const key = `${FOLDER}/${current.version}/${SOURCE}.chsongs`
  s3.objects.set(key, Buffer.from('not the published archive'))
  try {
    const archive = await api.get(`/api/song-sources/${SOURCE}/archive`)
    expect(archive.status()).toBe(502)
    expect((await archive.json()).error).toContain(
      'does not match its checksum',
    )
  } finally {
    s3.objects.set(key, current.archive)
  }
})

test('without a managed copy it falls back to the GitHub release', async () => {
  const release = await buildArchive('2026-11-19', [`RC Release Song ${ts}`])
  s3.objects.set(`/song-sources/${SOURCE}.chsongs`, release.archive)
  s3.objects.set(
    `/song-sources/${SOURCE}.chsongs.sha256`,
    Buffer.from(`${release.checksum}\n`),
  )
  s3.objects.delete(`${FOLDER}/latest.json`)

  const managed = await api.get(`/api/song-sources/${SOURCE}/managed`)
  expect((await managed.json()).data).toBeNull()
  const checksum = await api.get(`/api/song-sources/${SOURCE}/checksum`)
  expect((await checksum.json()).data.checksum).toBe(release.checksum)
  const archive = await api.get(`/api/song-sources/${SOURCE}/archive`)
  expect(Buffer.from(await archive.body())).toEqual(release.archive)

  await expect(await managedNote()).toHaveText('Managed by Church Hub')
})
