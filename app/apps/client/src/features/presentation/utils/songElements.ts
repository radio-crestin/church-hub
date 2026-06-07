import type { ContentType, SongContentConfig } from '../types'

/**
 * Picks the screen content type for a given song slide:
 *  - the FIRST slide uses the dedicated "Gama - Strofă" (`song_first_slide`)
 *    layout (gama + strofa),
 *  - the LAST slide uses "Strofă - Amin" (`song_last_slide`) layout
 *    (strofa + amin),
 *  - every middle slide uses `song`.
 * A single-slide song is both first and last; it falls back to `song`, whose
 * config keeps both the gama and the amin elements so neither is lost.
 */
export function resolveSongSlideContentType(
  isFirstSlide: boolean,
  isLastSlide: boolean,
): ContentType {
  if (isFirstSlide && isLastSlide) return 'song'
  if (isFirstSlide) return 'song_first_slide'
  if (isLastSlide) return 'song_last_slide'
  return 'song'
}

/**
 * Value for the song-key ("gama") element. It only appears on the FIRST slide,
 * only when the key-line display is enabled (`displayKeyLine`, default true),
 * and only when the song actually has a key. The element's position/style and
 * its on/off visibility live in the screen config (`song.songKey`); this just
 * decides the text to show.
 */
export function resolveSongKey(
  isFirstSlide: boolean,
  keyLine: string | null | undefined,
  songConfig: Pick<SongContentConfig, 'displayKeyLine'> | undefined,
): string | undefined {
  if (!isFirstSlide) return undefined
  if ((songConfig?.displayKeyLine ?? true) === false) return undefined
  const key = keyLine?.trim()
  return key ? key : undefined
}

/**
 * Value for the "Amin" element. It only appears on the LAST slide, and is
 * suppressed when the slide text already contains "amin" so the word isn't
 * shown twice (mirrors the previous inline behaviour).
 */
export function resolveAmen(
  isLastSlide: boolean,
  slideContent: string,
): string | undefined {
  if (!isLastSlide) return undefined
  if (/amin/i.test(slideContent)) return undefined
  return 'Amin!'
}
