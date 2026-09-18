export type BackgroundMediaKind = 'image' | 'video'

export interface BackgroundMediaType {
  mimeType: string
  extension: string
  kind: BackgroundMediaKind
}

/** A background image/video uploaded for presentation screens. */
export interface BackgroundMedia {
  /** File name on disk: `<uuid v4>.<ext>`. */
  id: string
  kind: BackgroundMediaKind
  mimeType: string
  /** Size in bytes. */
  size: number
  /** Relative URL: `/api/media/backgrounds/<id>`. */
  url: string
  /** Upload time (file mtime), ms since epoch. */
  createdAt: number
}

/** A background shipped with the app and copied into every install's gallery. */
export interface DefaultBackgroundMedia {
  /** File name inside the bundled `default-backgrounds` resource folder. */
  fileName: string
  /** Fixed media id it is stored under, so it is never copied twice. */
  id: string
}

export interface SaveBackgroundMediaInput {
  body: ReadableStream<Uint8Array> | null
  /** Raw `Content-Type` header value (parameters are ignored). */
  contentType: string | null
  /** Raw `Content-Length` header value, when the client sent one. */
  contentLength: string | null
  /** Original file name, used for logging only. */
  originalName?: string | null
}

/**
 * Outcome of parsing an HTTP `Range` header against a file size:
 * - `none`: no usable range (absent, malformed or multi-range) → serve 200.
 * - `unsatisfiable`: well-formed but outside the file → 416.
 * - `range`: inclusive byte range to serve with 206.
 */
export type ByteRangeResult =
  | { type: 'none' }
  | { type: 'unsatisfiable' }
  | { type: 'range'; start: number; end: number }
