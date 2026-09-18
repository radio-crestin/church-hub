import type { BackgroundMediaKind, BackgroundMediaType } from './types'

const MIB = 1024 * 1024

/** Public URL prefix the files are served under (relative to the API host). */
export const BACKGROUND_MEDIA_URL_PREFIX = '/api/media/backgrounds'

/** Accepted upload types. The extension is what the file is stored as. */
export const BACKGROUND_MEDIA_TYPES: readonly BackgroundMediaType[] = [
  { mimeType: 'image/jpeg', extension: 'jpg', kind: 'image' },
  { mimeType: 'image/png', extension: 'png', kind: 'image' },
  { mimeType: 'image/webp', extension: 'webp', kind: 'image' },
  { mimeType: 'image/gif', extension: 'gif', kind: 'image' },
  { mimeType: 'video/mp4', extension: 'mp4', kind: 'video' },
  { mimeType: 'video/webm', extension: 'webm', kind: 'video' },
]

/** Largest accepted upload per kind, in bytes. */
export const BACKGROUND_MEDIA_MAX_BYTES: Record<BackgroundMediaKind, number> = {
  image: 50 * MIB,
  video: 1024 * MIB,
}

/**
 * Bun rejects any request whose Content-Length exceeds `maxRequestBodySize`
 * (default 128 MiB) with a bare 413 before the handler runs. It is raised just
 * above the largest background video so the upload route can apply its own
 * per-kind limits and answer with a proper JSON error.
 */
export const BACKGROUND_MEDIA_MAX_REQUEST_BODY_BYTES =
  BACKGROUND_MEDIA_MAX_BYTES.video + MIB

/**
 * A stored file name doubles as the media id: `<uuid v4>.<ext>`. Anything else
 * is rejected before it reaches the file system, which rules out path
 * traversal (`..`, separators, encoded slashes) and hidden temp files.
 */
export const BACKGROUND_MEDIA_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|mp4|webm)$/
