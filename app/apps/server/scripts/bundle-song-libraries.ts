#!/usr/bin/env bun
/**
 * Ships the song sources Church Hub offers with the installer, so a church
 * with no internet can still import them (CH-177): the featured list
 * (libraries/featured.json) and each library's manifest and shards, in the
 * bucket's own layout, into app/tauri/resources/song-libraries (a Tauri
 * resource; read by service/song-sources/featured when offline).
 *
 *   bun scripts/bundle-song-libraries.ts [outDir]
 *
 * The sync service is CHURCH_HUB_SYNC_URL, else the backend the build
 * targets. No list published yet: the folder stays empty and the app
 * uses its built-in sources. Any other failure stops the build on CI and
 * only warns elsewhere (a developer's build offline).
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  type LibraryManifest,
  readLibraryShard,
} from '@church-hub/song-formats'

import { parseFeaturedSources } from '../src/service/song-sources/featured/parseFeaturedSources'
import { getSyncServiceUrl } from '../src/service/sync/cloud/getSyncServiceUrl'

const OUT_DIR =
  process.argv[2] ??
  join(import.meta.dir, '../../../tauri/resources/song-libraries')
const TIMEOUT_MS = 120_000

async function download(url: string): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`${response.status} from ${url}`)
  return response
}

function write(path: string, bytes: Uint8Array | string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
}

async function bundle(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true })
  // A fresh copy each build; the folder itself is tracked (Tauri needs it).
  for (const entry of readdirSync(OUT_DIR)) {
    if (entry !== '.gitkeep') rmSync(join(OUT_DIR, entry), { recursive: true })
  }
  const base = getSyncServiceUrl().replace(/\/+$/, '')
  const { featuredUrl } = (await (
    await download(`${base}/sync/libraries`)
  ).json()) as { featuredUrl?: string }
  if (!featuredUrl) throw new Error(`${base} names no featured list`)
  const listed = await fetch(`${featuredUrl}?at=${Date.now()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (listed.status === 404 || listed.status === 403) {
    console.warn('No featured sources published yet: none bundled.')
    return
  }
  if (!listed.ok) throw new Error(`${listed.status} from ${featuredUrl}`)
  const featured = parseFeaturedSources(await listed.text())

  for (const source of featured.sources) {
    const manifestUrl = new URL(`${source.sourceId}/manifest.json`, featuredUrl)
    const manifestText = await (await download(manifestUrl.toString())).text()
    const manifest = JSON.parse(manifestText) as LibraryManifest
    for (const shard of manifest.shards) {
      const bytes = new Uint8Array(
        await (
          await download(new URL(shard.path, manifestUrl).toString())
        ).arrayBuffer(),
      )
      await readLibraryShard(bytes, shard)
      write(join(OUT_DIR, source.sourceId, shard.path), bytes)
    }
    write(join(OUT_DIR, source.sourceId, 'manifest.json'), manifestText)
    console.log(
      `Bundled ${source.name}: ${manifest.songCount} songs, ${manifest.shards.length} shards`,
    )
  }
  write(
    join(OUT_DIR, 'featured.json'),
    JSON.stringify({ url: featuredUrl, featured }),
  )
}

try {
  await bundle()
} catch (error) {
  if (process.env.CI) throw error
  console.warn(`Song libraries not bundled: ${error}`)
}
