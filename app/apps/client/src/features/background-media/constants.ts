import type { BackgroundMediaKind } from './service/types'

const MIB = 1024 * 1024

/** Accepted MIME types per kind — mirrors the server's allow-list. */
export const BACKGROUND_MEDIA_MIME_TYPES: Record<
  BackgroundMediaKind,
  readonly string[]
> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
}

/** Largest accepted file per kind, in bytes — mirrors the server's limits. */
export const BACKGROUND_MEDIA_MAX_BYTES: Record<BackgroundMediaKind, number> = {
  image: 50 * MIB,
  video: 1024 * MIB,
}

/**
 * MIME type by file extension, for files the OS gives no type for (`File.type`
 * is empty when the platform has no mapping for the extension).
 */
export const BACKGROUND_MEDIA_EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
}
