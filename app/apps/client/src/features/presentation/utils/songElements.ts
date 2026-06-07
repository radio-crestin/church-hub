import type { ContentType, SongContentConfig } from '../types'

/**
 * Picks the screen content type for a given song slide:
 *  - the FIRST slide uses the dedicated "Gama - Strofă" (`song_first_slide`)
 *    layout (gama + strofa) — but ONLY when the slide actually shows a gama
 *    (`hasKey`); without a key it falls back to the plain `song` layout so the
 *    strofa isn't shifted to make room for an absent element,
 *  - the LAST slide uses "Strofă - Amin" (`song_last_slide`) layout
 *    (strofa + amin) — but ONLY when the slide actually shows an amin
 *    (`hasAmen`); otherwise it falls back to `song`,
 *  - every middle slide uses `song`.
 * A single-slide song that shows both a gama and an amin falls back to `song`,
 * whose config keeps both elements so neither is lost.
 */
export function resolveSongSlideContentType(
  isFirstSlide: boolean,
  isLastSlide: boolean,
  hasKey: boolean,
  hasAmen: boolean,
): ContentType {
  const useFirst = isFirstSlide && hasKey
  const useLast = isLastSlide && hasAmen
  if (useFirst && useLast) return 'song'
  if (useFirst) return 'song_first_slide'
  if (useLast) return 'song_last_slide'
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
