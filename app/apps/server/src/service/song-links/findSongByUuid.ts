import { idByUuid } from '../sync/records/idByUuid'

/** This device's song for a shared one (the church's uuid); null when absent. */
export function findSongByUuid(uuid: string): { songId: number } | null {
  const songId = idByUuid('songs', uuid)
  return songId ? { songId } : null
}
