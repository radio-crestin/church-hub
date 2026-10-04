import { summarizeChanges } from './summarizeChanges'
import type {
  SongHistoryEntry,
  SongHistoryEntrySummary,
  SongHistoryKind,
  SongSnapshot,
} from './types'
import type { songEditHistory } from '../../db/schema'

type HistoryRecord = typeof songEditHistory.$inferSelect

function parseSnapshot(json: string): SongSnapshot {
  return JSON.parse(json) as SongSnapshot
}

export function toHistoryEntry(record: HistoryRecord): SongHistoryEntry {
  const before = record.beforeSnapshot
    ? parseSnapshot(record.beforeSnapshot)
    : null
  const after = parseSnapshot(record.afterSnapshot)
  return {
    id: record.id,
    songId: record.songId,
    kind: record.kind as SongHistoryKind,
    editedByUserId: record.editedByUserId,
    editedByName: record.editedByName,
    restoredFromId: record.restoredFromId,
    createdAt: Math.floor(record.createdAt.getTime() / 1000),
    titleBefore: before?.title ?? null,
    titleAfter: after.title,
    changes: summarizeChanges(before, after),
    before,
    after,
  }
}

/** The list view leaves the snapshots out: they can be large. */
export function toHistorySummary(
  record: HistoryRecord,
): SongHistoryEntrySummary {
  const { before: _before, after: _after, ...summary } = toHistoryEntry(record)
  return summary
}
