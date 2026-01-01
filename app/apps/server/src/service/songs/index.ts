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
  getSongWithSlides,
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
