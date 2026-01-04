export interface SongCategory {
  id: number
  name: string
  priority: number
  songCount: number
  createdAt: number
  updatedAt: number
}

export interface Song {
  id: number
  title: string
  categoryId: number | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastManualEdit: number | null
  createdAt: number
  updatedAt: number
}

export interface SongSlide {
  id: number
  songId: number
  content: string
  sortOrder: number
  label: string | null
  createdAt: number
  updatedAt: number
}

export interface SongWithSlides extends Song {
  slides: SongSlide[]
  category: SongCategory | null
}

export interface SlideInput {
  id?: number | string
  content: string
  sortOrder: number
  label?: string | null
}

export interface UpsertSongInput {
  id?: number
  title: string
  categoryId?: number | null
  sourceFilename?: string | null
  author?: string | null
  copyright?: string | null
  ccli?: string | null
  key?: string | null
  tempo?: string | null
  timeSignature?: string | null
  theme?: string | null
  altTheme?: string | null
  hymnNumber?: string | null
  keyLine?: string | null
  presentationOrder?: string | null
  slides?: SlideInput[]
  /** When set, replaces the existing song with this ID (updates references and deletes it) */
  replaceExistingSongId?: number
}

export interface UpsertSlideInput {
  id?: number
  songId: number
  content: string
  sortOrder?: number
  label?: string | null
}

export interface UpsertCategoryInput {
  id?: number
  name: string
  priority?: number
}

export interface SongSearchResult {
  id: number
  title: string
  categoryId: number | null
  categoryName: string | null
  highlightedTitle: string
  matchedContent: string
}
