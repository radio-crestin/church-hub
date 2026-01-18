// Types

// Categories
export {
  deleteCategory,
  deleteUncategorizedSongs,
  getAllCategories,
  getCategoryById,
  reorderCategories,
  upsertCategory,
} from './categories'
export {
  completeSongReplacement,
  prepareForSongReplacement,
  type ReplaceSongReferencesResult,
  replaceSongReferences,
} from './replaceSongReferences'
// Search
export {
  batchUpdateSearchIndex,
  rebuildSearchIndex,
  removeFromSearchIndex,
  searchSongs,
  updateSearchIndex,
  updateSearchIndexByCategory,
} from './search'
// Song Slides
export {
  cloneSongSlide,
  deleteSongSlide,
  getSlidesBySongId,
  getSlidesBySongIds,
  getSongSlideById,
  reorderSongSlides,
  upsertSongSlide,
} from './song-slides'
// Songs
export {
  batchImportSongs,
  deleteSong,
  deleteSongsByIds,
  getAllSongs,
  getAllSongsWithSlides,
  getSongById,
  getSongByTitle,
  getSongsPaginated,
  getSongWithSlides,
  type PaginatedSongsResult,
  resetSongPresentationCount,
  type SongFilters,
  upsertSong,
} from './songs'
export type {
  BatchImportResult,
  BatchImportSongInput,
  OperationResult,
  ReorderCategoriesInput,
  ReorderSongSlidesInput,
  Song,
  SongCategory,
  SongCategoryRecord,
  SongRecord,
  SongSearchResult,
  SongSlide,
  SongSlideRecord,
  SongWithSlides,
  UpsertCategoryInput,
  UpsertSongInput,
  UpsertSongSlideInput,
} from './types'
