import type { SourceSong } from '@church-hub/song-formats'

import { lyricsKey, readKeptSongs } from './keptSongsStore'
import {
  isUntouched,
  readSongSourceState,
  type SongSourceState,
} from './readSongSourceState'
import { sourceLyricsHash } from './sourceLyricsHash'
import type { DiscoveryMatchResult, SourceLink } from '../../songs'

/** A library song and the source's newer version of it. */
export interface ChangedSong {
  songId: number
  song: SourceSong
  /**
   * Changed here since the source gave it (by hand, or its lyrics no longer
   * the source's): never updated on its own, only offered as a new version.
   */
  edited: boolean
}

/** What a check found about the library songs a source already has. */
export interface SourceMatches {
  changed: ChangedSong[]
  /** Songs with the source's lyrics not yet linked to it. */
  links: SourceLink[]
}

/** The verdicts that name the library song a source song is. */
const SAME_SONG = new Set(['exact-source', 'exact-lyrics', 'exact-filename'])

/**
 * Each source song and the library song it is. A library song several
 * source songs claim is left out: updating it from each in turn would
 * never settle.
 */
function sameSongMatches(
  verdicts: DiscoveryMatchResult[],
): Map<string, number> {
  const same = verdicts.filter(
    (v) => SAME_SONG.has(v.verdict) && v.exactSongId != null,
  )
  const claims = new Map<number, number>()
  for (const v of same) {
    const id = v.exactSongId as number
    claims.set(id, (claims.get(id) ?? 0) + 1)
  }
  return new Map(
    same
      .filter((v) => claims.get(v.exactSongId as number) === 1)
      .map((v) => [v.tempId, v.exactSongId as number]),
  )
}

/**
 * An update lands only on the song it came from: one this source added or
 * was linked to, or (before source links) one from the same file under the
 * same title, never another source's song.
 */
function cameFrom(
  sourceId: string,
  known: SongSourceState,
  song: SourceSong,
  verdict: string,
): boolean {
  if (known.source_id) return known.source_id === sourceId
  return (
    verdict === 'exact-filename' &&
    known.title.toLowerCase() === song.parsed.title.toLowerCase()
  )
}

/**
 * The library songs a source has, and which of them it changed since:
 * an untouched one (isUntouched) follows the source, an edited one is
 * offered as a new version with its lyrics diff, never replaced on its own.
 * A version the user turned down (kept their own over it) is not offered
 * again. A library song with the source's lyrics and no source yet is
 * linked to it, so it follows the source from now on.
 */
export function findChangedSongs(
  sourceId: string,
  songs: SourceSong[],
  verdicts: DiscoveryMatchResult[],
): SourceMatches {
  const same = sameSongMatches(verdicts)
  if (same.size === 0) return { changed: [], links: [] }
  const verdictOf = new Map(verdicts.map((v) => [v.tempId, v.verdict]))
  const library = readSongSourceState([...new Set(same.values())])
  const kept = new Map(readKeptSongs(sourceId).map((k) => [k.songId, k.lyrics]))
  const changed: ChangedSong[] = []
  const links: SourceLink[] = []
  for (const song of songs) {
    const id = same.get(song.id)
    const known = id == null ? undefined : library.get(id)
    if (!known) continue
    const fresh = sourceLyricsHash(song)
    if (fresh === known.content_hash) {
      if (!known.source_id && !known.last_manual_edit) {
        links.push({ songId: known.id, sourceSongId: song.id })
      }
      continue
    }
    if (!cameFrom(sourceId, known, song, verdictOf.get(song.id) ?? '')) continue
    if (kept.get(known.id) === lyricsKey(song)) continue
    changed.push({ songId: known.id, song, edited: !isUntouched(known) })
  }
  return { changed, links }
}
