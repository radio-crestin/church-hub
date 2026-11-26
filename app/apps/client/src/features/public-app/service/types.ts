/**
 * What the public app reads of the sync service's bucket formats
 * (churchhub-backend/src/sync/types.ts, the library's LibrarySong).
 */
export interface ChurchSlide {
  content: string
  label: string | null
  sortOrder: number
}

export interface ChurchSong {
  uuid: string
  title: string
  author: string | null
  slides: ChurchSlide[]
}

interface ObjectRef {
  seq: number
  key: string
}

export interface Head {
  seq: number
  snapshot: ObjectRef | null
  segments: ObjectRef[]
}

export interface Snapshot {
  songs: ChurchSong[]
}

export interface Segment {
  changes: {
    type: string
    uuid: string
    op: 'upsert' | 'delete'
    data?: ChurchSong
  }[]
}
