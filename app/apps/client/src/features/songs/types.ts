export interface ChordMapping {
  wordIndex: number
  chord: string
}

export interface SongCategory {
  id: number
  name: string
  priority: number
  songCount: number
  createdAt: number
  updatedAt: number
}

export interface SongTag {
  id: number
  name: string
  sortOrder: number
  songCount: number
  createdAt: number
  updatedAt: number
}

export interface Song {
  id: number
  title: string
  categoryId: number | null
  /**
   * Group this song belongs to (null = standalone / its own canonical
   * version). Members of the same `songGroupId` are versions of the same
   * underlying song.
   */
  songGroupId: number | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
  createdAt: number
  updatedAt: number
  /**
   * Tag names attached to this song. Only present on list endpoints that
   * hydrate it (e.g. paginated browse); legacy endpoints leave it undefined.
   */
  tagNames?: string[]
}

export interface SongSlide {
  id: number
  songId: number
  content: string
  chords: ChordMapping[] | null
  sortOrder: number
  label: string | null
  createdAt: number
  updatedAt: number
}

export interface SongWithSlides extends Song {
  slides: SongSlide[]
  category: SongCategory | null
  tags: SongTag[]
}

export interface SlideInput {
  id?: number | string
  content: string
  chords?: ChordMapping[] | null
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
  tempo?: string | null
  timeSignature?: string | null
  theme?: string | null
  altTheme?: string | null
  hymnNumber?: string | null
  keyLine?: string | null
  presentationOrder?: string | null
  presentationCount?: number
  slides?: SlideInput[]
  /**
   * Replaces the song's tag assignments. When omitted the existing
   * assignments are left untouched; an empty array clears them.
   */
  tagIds?: number[]
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

export interface UpsertTagInput {
  id?: number
  name: string
  sortOrder?: number
}

export interface SongSearchResult {
  id: number
  title: string
  categoryId: number | null
  categoryName: string | null
  keyLine: string | null
  highlightedTitle: string
  matchedContent: string
  presentationCount: number
  score: number
}

export interface AISearchResult extends SongSearchResult {
  aiRelevanceScore?: number
}

export interface AISearchResponse {
  results: AISearchResult[]
  termsUsed: string[]
  totalCandidates: number
  processingTimeMs: number
}

/**
 * A song group groups multiple `Song` rows that are versions of the same
 * underlying piece (translations, lyric edits, denominational variants).
 * Members keep their own rows; the group records the relationship.
 */
export interface SongGroupMember {
  songId: number
  title: string
  isPrimary: boolean
  hymnNumber: string | null
  author: string | null
  keyLine: string | null
}

export interface SongGroup {
  id: number
  canonicalTitle: string
  primarySongId: number | null
  memberSongIds: number[]
  members: SongGroupMember[]
  createdAt: number
  updatedAt: number
}
