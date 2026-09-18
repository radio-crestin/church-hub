export type BackgroundMediaKind = 'image' | 'video'

/** An image or video uploaded to the local server for screen backgrounds. */
export interface BackgroundMedia {
  /** File name on the server: `<uuid>.<ext>` */
  id: string
  kind: BackgroundMediaKind
  mimeType: string
  /** Size in bytes */
  size: number
  /** Relative URL (`/api/media/backgrounds/<id>`); resolve with `resolveMediaUrl` */
  url: string
  createdAt: number
}

/** What a picker reports: the chosen file's kind and URL ('' when cleared). */
export type BackgroundMediaSelection = Pick<BackgroundMedia, 'kind' | 'url'>

/** Why an upload was refused — each maps to `screens.background.errors.<code>` */
export type BackgroundMediaErrorCode =
  | 'unsupportedType'
  | 'fileTooLarge'
  | 'uploadFailed'
