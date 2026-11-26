import type { SourceSong } from '@church-hub/song-formats'

import { lyricsHash } from '../../songs'

/** A source song's lyrics fingerprint, as its slides would be stored here. */
export function sourceLyricsHash(song: SourceSong): string | null {
  return lyricsHash(song.parsed.slides.map((slide) => slide.htmlContent))
}
