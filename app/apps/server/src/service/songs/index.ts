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
// Discovery (external-source import)
export { countNewCandidates, matchCandidatesAgainstLibrary } from './discovery'
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
  getSimilarSongs,
  getSimilarSongsForContent,
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
  DiscoveryCandidateInput,
  DiscoveryMatchResult,
  DiscoveryMatchVerdict,
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
  SongVersionSuggestion,
  SongWithSlides,
  UpsertCategoryInput,
  UpsertSongGroupInput,
  UpsertSongInput,
  UpsertSongSlideInput,
  UpsertTagInput,
} from './types'
