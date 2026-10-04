import { buildSongSnapshot } from './buildSongSnapshot'
import type { SongSnapshot } from './types'
import { getSlidesBySongId } from '../songs/song-slides'
import { getSongById } from '../songs/songs'

/** The song's title and slides as stored right now, or null if it is gone. */
export function captureSongSnapshot(songId: number): SongSnapshot | null {
  const song = getSongById(songId)
  if (!song) return null
  return buildSongSnapshot(song.title, getSlidesBySongId(songId))
}
