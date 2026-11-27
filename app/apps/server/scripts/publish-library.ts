#!/usr/bin/env bun
/**
 * Publishes a song file as a library Church Hub manages (CH-177): Resurse
 * Creștine and the other sources every app is offered, in the shared
 * library format (manifest + shards), through the sync service, with the
 * build's LIBRARY_PUBLISH_TOKEN. Only shards the bucket lacks are sent.
 * A curator then lists it on the Church Hub Library page (Featured
 * sources), or it stays as it is when already listed.
 *
 *   LIBRARY_PUBLISH_TOKEN=… bun scripts/publish-library.ts <song file> <sourceId> [name] [category]
 *
 * <song file>: a .chsongs bundle (or any ZIP of OpenSong files); name and
 * category default to the bundle's. The service is CHURCH_HUB_SYNC_URL,
 * else the default backend. Run by resurse-crestine-archive.yml after it
 * builds resurse-crestine.chsongs (docs/managed-song-sources.md).
 */
import { readFileSync } from 'node:fs'
import {
  buildLibrary,
  type LibraryManifest,
  parseOpenSongXml,
  readSongBundleZip,
} from '@church-hub/song-formats'

import { getSyncServiceUrl } from '../src/service/sync/cloud/getSyncServiceUrl'

const TIMEOUT_MS = 120_000

const [file, sourceId, nameArg, categoryArg] = process.argv.slice(2)
const token = process.env.LIBRARY_PUBLISH_TOKEN
if (!file || !sourceId || !token) {
  console.error(
    'Usage: LIBRARY_PUBLISH_TOKEN=… bun scripts/publish-library.ts <song file> <sourceId> [name] [category]',
  )
  process.exit(1)
}

const service = `${getSyncServiceUrl().replace(/\/+$/, '')}/sync/libraries/${sourceId}`

async function call(
  method: 'GET' | 'PUT',
  path: string,
  body?: Uint8Array | object,
): Promise<Response> {
  const binary = body instanceof Uint8Array
  return fetch(`${service}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': binary ? 'application/gzip' : 'application/json',
    },
    body: binary
      ? new Blob([body as BlobPart])
      : body
        ? JSON.stringify(body)
        : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

/** The library as published now (null before the first publish). */
async function readPublished(): Promise<LibraryManifest | null> {
  const { manifestUrl } = (await (await call('GET', '')).json()) as {
    manifestUrl: string
  }
  const response = await fetch(`${manifestUrl}?at=${Date.now()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (response.status === 404 || response.status === 403) return null
  if (!response.ok) throw new Error(`${response.status} from ${manifestUrl}`)
  return (await response.json()) as LibraryManifest
}

const bundle = await readSongBundleZip(readFileSync(file))
const songs = bundle.files.map((song) => {
  const parsed = parseOpenSongXml(song.xml, song.path, {
    exactTitle: bundle.ownFormat,
  })
  return {
    id: song.id,
    title: parsed.title,
    xml: song.xml,
    lyrics: parsed.slides.map((slide) => slide.text),
  }
})
const { manifest, shards } = await buildLibrary(
  {
    sourceId,
    name: nameArg || bundle.name || sourceId,
    categoryName: categoryArg || bundle.categoryName || nameArg || sourceId,
    listed: true,
    publisher: 'Church Hub',
  },
  songs,
)

const published = await readPublished()
if (published?.checksum === manifest.checksum) {
  console.log(`${sourceId}: unchanged (${manifest.songCount} songs)`)
  process.exit(0)
}
const known = new Set(published?.shards.map((shard) => shard.path))
let sent = 0
for (const shard of manifest.shards) {
  if (known.has(shard.path)) continue
  const response = await call(
    'PUT',
    `/shards/${shard.hash}`,
    shards.get(shard.path),
  )
  if (!response.ok) {
    throw new Error(
      `Shard ${shard.hash}: ${response.status} ${await response.text()}`,
    )
  }
  sent++
}
let answer = await call('PUT', '/manifest', {
  baseChecksum: published?.checksum ?? null,
  manifest,
})
if (answer.status === 409) {
  const { checksum } = (await answer.json()) as { checksum: string | null }
  answer = await call('PUT', '/manifest', { baseChecksum: checksum, manifest })
}
if (!answer.ok) {
  throw new Error(`Manifest: ${answer.status} ${await answer.text()}`)
}
console.log(
  `${sourceId}: published ${manifest.songCount} songs, ${sent} of ${manifest.shards.length} shards sent`,
)
