import type {
  BackgroundMediaKind,
  BackgroundMediaType,
  DefaultBackgroundMedia,
} from './types'

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

/**
 * Folder of the backgrounds shipped with the app, inside the bundled resources
 * (`tauri/resources/default-backgrounds` in the repo).
 */
export const DEFAULT_BACKGROUND_MEDIA_RESOURCE_DIR = 'default-backgrounds'

/**
 * Backgrounds every install gets in its gallery. Each is copied once under a
 * fixed id, so a copy is never duplicated and one the user deleted is never
 * brought back.
 */
export const DEFAULT_BACKGROUND_MEDIA: readonly DefaultBackgroundMedia[] = [
  {
    fileName: 'purple-abstract-waves.mp4',
    id: 'bea7e008-f3d1-4f28-b428-d8ced373f17a.mp4',
  },
]

/** `app_settings` key set once the default backgrounds have been copied. */
export const DEFAULT_BACKGROUND_MEDIA_MARKER_KEY = 'default_background_media_v1'
