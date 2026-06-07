// ChromaDB search experiment — local Chroma server (spawned as a child
// process), SQLite→Chroma sync, and chroma-backed search behind the
// search-engine toggle. SQLite remains the source of truth; everything in
// Chroma is derived and rebuildable via full resync.

export { runSearchBenchmark } from './benchmark'
export { initializeChroma, resyncChroma } from './bootstrap'
export {
  clearChromaClientCache,
  resetChromaCollections,
} from './client'
export {
  getEffectiveSearchEngine,
  getSearchEngine,
  setSearchEngine,
} from './engine'
export {
  searchBibleChroma,
  searchSchedulesChroma,
  searchSongsChroma,
} from './search'
export {
  getChromaPort,
  startChromaServer,
  stopChromaServer,
} from './serverProcess'
export { getChromaStatus, isChromaReady } from './status'
export {
  flushChromaQueue,
  fullChromaSync,
  queueChromaBibleTranslationRemove,
  queueChromaBibleTranslationSync,
  queueChromaCategorySync,
  queueChromaScheduleRemove,
  queueChromaScheduleSync,
  queueChromaSongRemove,
  queueChromaSongSync,
} from './sync'
export type {
  ChromaSyncStatus,
  SearchEngine,
} from './types'
export { SEARCH_ENGINES } from './types'
