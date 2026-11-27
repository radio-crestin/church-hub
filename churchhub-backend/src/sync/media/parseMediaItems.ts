import { SyncError } from '../SyncError'

/** One file the church's synced data shows: its id on the PC and content. */
export interface MediaItem {
  /** The PC's media id (`<uuid>.<ext>`), as synced rows name it. */
  id: string
  /** sha256 of the file, hex: its name in the bucket. */
  hash: string
  size: number
  type: string
}

/** The media types the app stores (background-media's own list). */
export const MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
])

const MAX_ITEMS = 10_000
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const HASH = /^[0-9a-f]{64}$/

function invalid(message: string): never {
  throw new SyncError(400, 'invalid_request', message)
}

/** The body of `POST media`: every file the church's data references. */
export function parseMediaItems(body: unknown): MediaItem[] {
  const items = (body as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) invalid('items must be an array')
  if (items.length > MAX_ITEMS) invalid(`At most ${MAX_ITEMS} items`)
  const seen = new Set<string>()
  return items.map((raw) => {
    const item = raw as Partial<MediaItem> | null
    if (typeof item?.id !== 'string' || !ID.test(item.id)) invalid('Invalid media id')
    if (seen.has(item.id)) invalid(`Duplicate media id ${item.id}`)
    seen.add(item.id)
    if (typeof item.hash !== 'string' || !HASH.test(item.hash)) invalid('Invalid hash')
    if (!Number.isSafeInteger(item.size) || (item.size as number) <= 0) {
      invalid('Invalid size')
    }
    if (typeof item.type !== 'string' || !MEDIA_TYPES.has(item.type)) {
      invalid(`Unsupported media type ${String(item.type)}`)
    }
    return { id: item.id, hash: item.hash, size: item.size as number, type: item.type }
  })
}
