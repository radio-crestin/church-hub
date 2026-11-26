/**
 * Publishes a managed song source's archive to Church Hub's bucket, laid
 * out as in src/service/song-sources/managed/types.ts: the files under a new
 * `<version>/` (cached for good), then `latest.json` (cached briefly). Only
 * when the songs changed (the bundle's checksum differs from the published
 * one); keeps the newest KEEP_VERSIONS versions and deletes older ones.
 * Run by .github/workflows/resurse-crestine-archive.yml; setup in
 * docs/managed-song-sources.md.
 *
 * Usage: bun scripts/publish-managed-source.ts <archive-dir> <source-id>
 * Reads <archive-dir>/<source-id>.chsongs (and <source-id>-opensong.zip when
 * there). Credentials from SONG_SOURCES_S3_ENDPOINT, _BUCKET,
 * _ACCESS_KEY_ID, _SECRET_ACCESS_KEY and, optionally, _REGION. Writes
 * `published=true|false` and `archive=<key>` to $GITHUB_OUTPUT when set.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'
import JSZip from 'jszip'

import { BUILT_IN_SONG_SOURCES } from '../src/service/song-sources/builtInSongSources'
import {
  MANIFEST_FILE,
  SONG_BUNDLE_EXTENSION,
  type SongBundleManifest,
} from '../src/service/song-sources/bundle/types'
import {
  MANAGED_MANIFEST_FILE,
  MANAGED_MANIFEST_FORMAT,
  MANAGED_MANIFEST_VERSION,
  type ManagedFile,
  type ManagedManifest,
} from '../src/service/song-sources/managed/types'

const KEEP_VERSIONS = 5
const VERSIONED_CACHE = 'public, max-age=31536000, immutable'
const MANIFEST_CACHE = 'public, max-age=300'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** The bucket, path-style and signed with SigV4 (any S3-compatible store). */
function openBucket() {
  const client = new AwsClient({
    accessKeyId: requireEnv('SONG_SOURCES_S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('SONG_SOURCES_S3_SECRET_ACCESS_KEY'),
    service: 's3',
    region: process.env.SONG_SOURCES_S3_REGION || 'auto',
  })
  const endpoint = requireEnv('SONG_SOURCES_S3_ENDPOINT').replace(/\/+$/, '')
  const base = `${endpoint}/${requireEnv('SONG_SOURCES_S3_BUCKET')}`
  const send = async (method: string, key: string, init: RequestInit = {}) => {
    const url = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
    const response = await client.fetch(url, { method, ...init })
    if (!response.ok && response.status !== 404) {
      const detail = (await response.text()).slice(0, 200)
      throw new Error(`S3 ${method} ${key}: ${response.status} ${detail}`)
    }
    return response
  }
  return {
    async getText(key: string): Promise<string | null> {
      const response = await send('GET', key)
      return response.status === 404 ? null : response.text()
    },
    put: (
      key: string,
      body: Uint8Array<ArrayBuffer> | string,
      type: string,
      cache: string,
    ) =>
      send('PUT', key, {
        body,
        headers: { 'Content-Type': type, 'Cache-Control': cache },
      }),
    delete: (key: string) => send('DELETE', key),
  }
}

/** The manifest inside a `.chsongs` archive. */
async function readBundleManifest(
  archive: Uint8Array,
): Promise<SongBundleManifest> {
  const zip = await JSZip.loadAsync(archive)
  const text = await zip.file(MANIFEST_FILE)?.async('string')
  if (!text) throw new Error('The archive has no manifest.json')
  return JSON.parse(text) as SongBundleManifest
}

/** The published manifest, or null when there is none (or not ours). */
function parsePublished(text: string | null): ManagedManifest | null {
  if (!text) return null
  const manifest = JSON.parse(text) as ManagedManifest
  return manifest.format === MANAGED_MANIFEST_FORMAT ? manifest : null
}

/** "2026-11-26T03:17:00Z" + checksum → "2026.11.26-3f9a1c". */
const versionOf = (builtAt: string, checksum: string) =>
  `${builtAt.slice(0, 10).replaceAll('-', '.')}-${checksum.slice(0, 6)}`

const sha256Of = (bytes: Uint8Array) =>
  new Bun.CryptoHasher('sha256').update(bytes).digest('hex')

function writeOutput(values: Record<string, string>): void {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  for (const [key, value] of Object.entries(values)) {
    appendFileSync(file, `${key}=${value}\n`)
  }
}

async function main() {
  const [dir, sourceId] = process.argv.slice(2)
  if (!dir || !sourceId) throw new Error('usage: <archive-dir> <source-id>')
  const folder = BUILT_IN_SONG_SOURCES.find((s) => s.id === sourceId)?.managed
  if (!folder) throw new Error(`${sourceId} is not a managed song source`)

  const names = [
    `${sourceId}${SONG_BUNDLE_EXTENSION}`,
    `${sourceId}-opensong.zip`,
  ].filter((name) => existsSync(join(dir, name)))
  if (!names[0]?.endsWith(SONG_BUNDLE_EXTENSION)) {
    throw new Error(
      `${join(dir, `${sourceId}${SONG_BUNDLE_EXTENSION}`)} is missing`,
    )
  }
  const contents = names.map(
    (name) => new Uint8Array(readFileSync(join(dir, name))),
  )
  const bundle = await readBundleManifest(contents[0] as Uint8Array)

  const bucket = openBucket()
  const manifestKey = `${folder}/${MANAGED_MANIFEST_FILE}`
  const published = parsePublished(await bucket.getText(manifestKey))
  if (published?.checksum === bundle.checksum) {
    // biome-ignore lint/suspicious/noConsole: CI log
    console.log(`Unchanged: ${published.version} is already published`)
    writeOutput({ published: 'false' })
    return
  }

  const version = versionOf(bundle.updatedAt, bundle.checksum)
  const files: ManagedFile[] = []
  for (const [index, name] of names.entries()) {
    const bytes = contents[index] as Uint8Array<ArrayBuffer>
    const path = `${version}/${name}`
    await bucket.put(
      `${folder}/${path}`,
      bytes,
      'application/zip',
      VERSIONED_CACHE,
    )
    files.push({ name, path, size: bytes.byteLength, sha256: sha256Of(bytes) })
  }

  const versions = [
    version,
    ...(published?.versions ?? []).filter((v) => v !== version),
  ]
  const manifest: ManagedManifest = {
    format: MANAGED_MANIFEST_FORMAT,
    formatVersion: MANAGED_MANIFEST_VERSION,
    sourceId,
    name: bundle.name,
    version,
    checksum: bundle.checksum,
    songCount: bundle.songs.length,
    builtAt: bundle.updatedAt,
    files,
    versions: versions.slice(0, KEEP_VERSIONS),
  }
  await bucket.put(
    manifestKey,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'application/json',
    MANIFEST_CACHE,
  )

  for (const old of versions.slice(KEEP_VERSIONS)) {
    for (const name of names) await bucket.delete(`${folder}/${old}/${name}`)
  }
  // biome-ignore lint/suspicious/noConsole: CI log
  console.log(
    `Published ${version}: ${manifest.songCount} songs, checksum ${manifest.checksum}`,
  )
  writeOutput({ published: 'true', archive: `${folder}/${files[0]?.path}` })
}

await main()
