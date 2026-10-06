import { type APIRequestContext, expect } from '@playwright/test'

import type { FakeS3 } from './fake-s3'

/**
 * A song source for specs: a shared folder (manifest.json plus one OpenSong
 * file per song) on the stand-in S3, added as a source from its link and
 * checked by the server's song updates, as the app does after start.
 */

export interface FolderSong {
  id: string
  title: string
  /** The song's OpenSong file (see openSongXml). */
  xml: string
}

export function openSongXml(title: string, lyrics: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<song>
  <title>${title}</title>
  <lyrics>[V1]
${lyrics.map((line) => ` ${line}`).join('\n')}
</lyrics>
</song>`
}

/** Puts the folder on the stand-in S3; a new checksum means new songs. */
export function publishSongFolder(
  s3: FakeS3,
  folder: string,
  name: string,
  songs: FolderSong[],
  checksum: string,
): string {
  const manifest = {
    format: 'church-hub-song-bundle',
    version: 2,
    name,
    categoryName: name,
    checksum,
    updatedAt: new Date().toISOString(),
    songs: songs.map((song) => ({
      id: song.id,
      title: song.title,
      path: `songs/${song.id}.opensong`,
      hash: `${song.id}-${checksum}`,
    })),
  }
  s3.objects.set(
    `${folder}/manifest.json`,
    Buffer.from(JSON.stringify(manifest)),
  )
  for (const song of songs) {
    s3.objects.set(`${folder}/songs/${song.id}.opensong`, Buffer.from(song.xml))
  }
  return `${s3.endpoint}${folder}/manifest.json`
}

export async function addLinkSource(
  request: APIRequestContext,
  url: string,
): Promise<string> {
  const added = await request.post('/api/song-sources', { data: { url } })
  expect(added.ok()).toBeTruthy()
  return (await added.json()).data.id as string
}

export async function setAutoUpdate(
  request: APIRequestContext,
  autoUpdate: boolean,
): Promise<void> {
  const res = await request.put('/api/song-sources/updates/settings', {
    data: { autoUpdate },
  })
  expect(res.ok()).toBeTruthy()
}

/** What a check found for one source (GET /api/song-sources/updates). */
export interface SourceCheck {
  newCount: number
  similarCount: number
  changedCount: number
  imported: number
  updated: number
}

/** Checks the source now (in the server's worker) and waits for the result. */
export async function checkSource(
  request: APIRequestContext,
  sourceId: string,
): Promise<SourceCheck> {
  const run = await request.post('/api/song-sources/updates/run', {
    data: { sourceIds: [sourceId] },
  })
  expect(run.status()).toBe(202)
  let source: SourceCheck | undefined
  await expect(async () => {
    const state = (
      await (await request.get('/api/song-sources/updates')).json()
    ).data
    expect(state.running).toBe(false)
    source = state.sources.find(
      (s: { sourceId: string }) => s.sourceId === sourceId,
    )
    expect(source).toBeTruthy()
  }).toPass({ timeout: 60_000 })
  return source as SourceCheck
}

/**
 * Removes every notification, so a spec starts from none and leaves no
 * pop-up over the next spec's page.
 */
export async function clearNotifications(
  request: APIRequestContext,
): Promise<void> {
  const res = await request.get('/api/notifications')
  for (const { id } of (await res.json()).data as { id: string }[]) {
    await request.delete(`/api/notifications/${encodeURIComponent(id)}`)
  }
}
