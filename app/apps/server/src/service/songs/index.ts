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
// Song Groups (versions)
export {
  getGroupForSong,
  getSongGroupWithMembers,
  getVersionCounts,
  linkSongs,
  mergeGroups,
  setPrimarySong,
  unlinkSong,
} from './song-groups'
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
export type {
  BatchImportResult,
  BatchImportSongInput,
  OperationResult,
  ReorderCategoriesInput,
  ReorderSongSlidesInput,
  ReorderTagsInput,
  Song,
  SongCategory,
  SongCategoryRecord,
  SongGroup,
  SongGroupMember,
  SongGroupRecord,
  SongGroupWithMembers,
  SongRecord,
  SongSearchResult,
  SongSlide,
  SongSlideRecord,
  SongTag,
  SongWithSlides,
  UpsertCategoryInput,
  UpsertSongGroupInput,
  UpsertSongInput,
  UpsertSongSlideInput,
  UpsertTagInput,
} from './types'
