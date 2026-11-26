import {
  COLLECTION_BY_TYPE,
  type LibraryTombstone,
  type Segment,
} from './types'

/** A library being rebuilt: each collection and the tombstones, by uuid key. */
export interface LibraryState {
  seq: number
  collections: Record<string, Map<string, Record<string, unknown>>>
  tombstones: Map<string, LibraryTombstone>
  versions: Record<string, number>
}

/** Applies one log segment, in order: the later change of a row wins. */
export function applySegment(state: LibraryState, segment: Segment): void {
  for (const change of segment.changes) {
    const key = `${change.type}:${change.uuid}`
    const collection = state.collections[COLLECTION_BY_TYPE[change.type]]
    if (change.op === 'upsert' && change.data) {
      collection.set(change.uuid, change.data)
      state.tombstones.delete(key)
    } else {
      collection.delete(change.uuid)
      state.tombstones.set(key, {
        entityType: change.type,
        uuid: change.uuid,
        deletedAt: change.deletedAt ?? segment.committedAt,
      })
    }
    state.versions[key] = change.version
  }
  state.seq = segment.seq
}
