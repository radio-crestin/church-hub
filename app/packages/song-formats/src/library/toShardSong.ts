import { lyricsFingerprint } from './lyricsFingerprint'
import { sha256Hex } from './sha256Hex'
import type { LibraryShardSong, LibrarySongInput } from './types'

/** A song as a shard holds it: with its hash and lyrics fingerprint. */
export async function toShardSong(
  song: LibrarySongInput,
): Promise<LibraryShardSong> {
  return {
    id: song.id,
    title: song.title,
    hash: await sha256Hex(song.xml),
    fingerprint: (await lyricsFingerprint(song.lyrics)) ?? '',
    xml: song.xml,
  }
}
