import type { ChromaSyncStatus } from './types'

/**
 * Singleton runtime status for the ChromaDB engine (server process + sync).
 * Read by /api/search/chroma-status and the client settings UI.
 */
const status: ChromaSyncStatus = {
  state: process.env.CHROMA_DISABLED === 'true' ? 'disabled' : 'stopped',
  port: null,
  counts: { songs: 0, bible_verses: 0, schedules: 0 },
  progress: 0,
  step: null,
  lastError: null,
  lastFullSyncMs: null,
  lastFullSyncAt: null,
}

export function getChromaStatus(): ChromaSyncStatus {
  return status
}

export function updateChromaStatus(patch: Partial<ChromaSyncStatus>): void {
  Object.assign(status, patch)
}

export function isChromaReady(): boolean {
  return status.state === 'ready' || status.state === 'syncing'
}
