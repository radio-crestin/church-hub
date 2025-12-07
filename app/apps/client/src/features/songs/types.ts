export interface SongCategory {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

export interface Song {
  id: number
  title: string
  categoryId: number | null
  createdAt: number
  updatedAt: number
}

export interface SongSlide {
  id: number
  songId: number
  content: string
  sortOrder: number
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
}

export interface UpsertSongInput {
  id?: number
  title: string
  categoryId?: number | null
  slides?: SlideInput[]
}

export interface UpsertSlideInput {
  id?: number
  songId: number
  content: string
  sortOrder?: number
}

export interface UpsertCategoryInput {
  id?: number
  name: string
}

export interface SongSearchResult {
  id: number
  title: string
  categoryId: number | null
  categoryName: string | null
  matchedContent: string
}
