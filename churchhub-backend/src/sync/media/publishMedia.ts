import type { MediaItem } from './parseMediaItems'
import { churchPrefix } from '../churchPrefix'
import { HEAD_CACHE_CONTROL } from '../publishHead'
import type { ChurchState, SyncStore } from '../state/ChurchState'
import { IMMUTABLE_CACHE_CONTROL } from '../writeSnapshot'

/** How long a presigned upload stays valid. */
const UPLOAD_TTL_SECONDS = 15 * 60

export interface MediaLimits {
  maxBytes: number
  maxFileBytes: number
}

/** A file the church may not keep in the bucket, and why. */
export interface SkippedMedia {
  id: string
  reason: 'file_too_large' | 'church_limit'
}

export interface MediaUpload {
  hash: string
  url: string
  /** The headers the PUT must send (they are signed). */
  headers: Record<string, string>
}

export interface PublishMediaResult {
  /** Files readers find now (in the index). */
  available: number
  /** Files to upload: PUT each, then publish again to list them. */
  uploads: MediaUpload[]
  skipped: SkippedMedia[]
}

/** `<prefix>/media/<sha256>`: one object per content, shared by its ids. */
export const mediaKey = (prefix: string, hash: string) => `${prefix}/media/${hash}`
export const mediaIndexKey = (prefix: string) => `${prefix}/media/index.json`

/** What fits the church's limits, in the order the PC sent (its priority). */
function withinLimits(items: MediaItem[], limits: MediaLimits) {
  const kept: MediaItem[] = []
  const skipped: SkippedMedia[] = []
  const counted = new Set<string>()
  let total = 0
  for (const item of items) {
    if (item.size > limits.maxFileBytes) {
      skipped.push({ id: item.id, reason: 'file_too_large' })
      continue
    }
    const added = counted.has(item.hash) ? 0 : item.size
    if (total + added > limits.maxBytes) {
      skipped.push({ id: item.id, reason: 'church_limit' })
      continue
    }
    total += added
    counted.add(item.hash)
    kept.push(item)
  }
  return { kept, skipped }
}

/**
 * The church's media in the bucket, as the PC's synced data references it
 * (`items`: all of it, each time). Files already there are listed in
 * `media/index.json`, which readers look ids up in; missing ones get a
 * presigned upload (the bytes go straight to the bucket); files no longer
 * referenced are deleted. All under the church's secret prefix, so a path
 * rotation leaves them behind with the old path, and the PC publishes again.
 */
export async function publishMedia(
  store: SyncStore,
  state: ChurchState,
  items: MediaItem[],
  limits: MediaLimits
): Promise<PublishMediaResult> {
  const prefix = churchPrefix(state.id, state.pathSecret)
  const { kept, skipped } = withinLimits(items, limits)
  const stored = new Set(
    (await store.bucket.list(`${prefix}/media/`))
      .map((key) => key.slice(`${prefix}/media/`.length))
      .filter((name) => name !== 'index.json')
  )

  const index: Record<string, Omit<MediaItem, 'id'>> = {}
  const missing = new Map<string, MediaItem>()
  for (const item of kept) {
    if (stored.has(item.hash)) {
      index[item.id] = { hash: item.hash, size: item.size, type: item.type }
    } else {
      missing.set(item.hash, item)
    }
  }

  const uploads: MediaUpload[] = []
  for (const item of missing.values()) {
    const headers = {
      'Content-Type': item.type,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
    }
    const url = await store.bucket.presignPut(
      mediaKey(prefix, item.hash),
      {
        contentType: item.type,
        contentLength: item.size,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      },
      UPLOAD_TTL_SECONDS
    )
    uploads.push({ hash: item.hash, url, headers })
  }

  await store.bucket.put(
    mediaIndexKey(prefix),
    new TextEncoder().encode(JSON.stringify({ media: index })),
    { contentType: 'application/json', cacheControl: HEAD_CACHE_CONTROL }
  )

  const referenced = new Set(kept.map((item) => item.hash))
  for (const hash of stored) {
    if (!referenced.has(hash)) await store.bucket.delete(mediaKey(prefix, hash))
  }

  return { available: Object.keys(index).length, uploads, skipped }
}
