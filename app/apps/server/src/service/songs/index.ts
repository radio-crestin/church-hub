// Types

// Categories
export {
  deleteCategory,
  getAllCategories,
  getCategoryById,
  upsertCategory,
} from './categories'
// Search
export {
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
  getAllSongs,
  getSongById,
  getSongWithSlides,
  upsertSong,
} from './songs'
export type {
  BatchImportResult,
  BatchImportSongInput,
  OperationResult,
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
