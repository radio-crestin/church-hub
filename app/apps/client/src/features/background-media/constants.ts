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

/**
 * When an animated GIF is heavy enough to play choppy or freeze on a screen
 * (WebKit, the desktop app's webview, stalls on long GIFs), so the upload asks
 * for confirmation first. It must have at least this many frames…
 */
export const HEAVY_GIF_MIN_FRAMES = 2

/** …and be larger than this file size… */
export const HEAVY_GIF_MAX_FILE_BYTES = 5 * MIB

/** …or decode to more than this (frames × width × height × 4 bytes). */
export const HEAVY_GIF_MAX_DECODED_BYTES = 100 * MIB
