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
// Tags
export {
  deleteTag,
  getAllTags,
  getTagsBySongId,
  getTagsBySongIds,
  reorderTags,
  setSongTags,
  upsertTag,
} from './tags'
export {
  completeSongReplacement,
  type ReplaceSongReferencesResult,
} from './replaceSongReferences'
// Search
export {
  batchUpdateSearchIndex,
  clearSearchCache,
  rebuildSearchIndex,
  removeFromSearchIndex,
  searchSongs,
  updateSearchIndex,
  updateSearchIndexByCategory,
  warmupSearchIndex,
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
  ReorderTagsInput,
  ReorderSongSlidesInput,
  Song,
  SongCategory,
  SongCategoryRecord,
  SongRecord,
  SongSearchResult,
  SongSlide,
  SongSlideRecord,
  SongTag,
  SongWithSlides,
  UpsertCategoryInput,
  UpsertTagInput,
  UpsertSongInput,
  UpsertSongSlideInput,
} from './types'
