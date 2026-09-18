import type { BackgroundMediaKind } from '~/features/background-media/service/types'

/** Which uploaded files the gallery shows: all of them, or one kind. */
export type GalleryFilter = 'all' | BackgroundMediaKind

/** Where a multi-file upload is: the file being sent and how many there are. */
export interface GalleryUploadProgress {
  current: number
  total: number
}
