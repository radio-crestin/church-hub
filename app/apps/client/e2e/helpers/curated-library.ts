import {
  type LibraryManifest,
  type LibraryShard,
  readLibraryShard,
} from '@church-hub/song-formats'
import type { APIRequestContext } from '@playwright/test'

import type { FakeS3 } from './fake-s3'
import { SYNC_BUCKET } from './sync-service'

/** The curated Church Hub Library as any reader sees it in the bucket. */
export async function readCuratedLibrary(s3: FakeS3): Promise<{
  manifest: LibraryManifest | null
  shards: LibraryShard[]
}> {
  const base = `${s3.endpoint}/${SYNC_BUCKET}/libraries/church-hub`
  const response = await fetch(`${base}/manifest.json`)
  if (!response.ok) return { manifest: null, shards: [] }
  const manifest = (await response.json()) as LibraryManifest
  const shards = []
  for (const entry of manifest.shards) {
    const bytes = new Uint8Array(
      await (await fetch(`${base}/${entry.path}`)).arrayBuffer(),
    )
    shards.push(await readLibraryShard(bytes, entry))
  }
  return { manifest, shards }
}

/** Signs the curator in the way the browser would, without a page. */
export async function signInCurator(request: APIRequestContext) {
  const started = await request.post('/api/sync/cloud/owner/sign-in', {
    data: { intent: 'curate' },
  })
  if (started.status() !== 200) {
    throw new Error(`sign-in refused: ${started.status()}`)
  }
  const page = await fetch((await started.json()).data.authUrl)
  return page.text()
}

/**
 * A Google sign-in followed by hand up to the PC's callback, whose ticket
 * is returned instead of handed to the PC: a spec calls the service with it.
 */
export async function takeCuratorTicket(
  request: APIRequestContext,
): Promise<string> {
  const started = await request.post('/api/sync/cloud/owner/sign-in', {
    data: { intent: 'curate' },
  })
  let url: string = (await started.json()).data.authUrl
  for (let hop = 0; hop < 6; hop++) {
    const ticket = new URL(url).searchParams.get('ticket')
    if (ticket) return ticket
    const response = await fetch(url, { redirect: 'manual' })
    const next = response.headers.get('location')
    if (!next) throw new Error(`sign-in stopped at ${response.status}`)
    url = new URL(next, url).toString()
  }
  throw new Error('sign-in never reached the callback')
}
