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

/** Strip HTML tags + decode the few entities the lyrics use, to plain text. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True when a text line consists solely of one or more "amin" words. */
function isAminLine(text: string): boolean {
  return /^(?:amin[\s,.!…]*)+$/i.test(text.trim())
}

/**
 * If a song slide's lyrics end with a standalone "amin" line, pull it out so it
 * can be shown through the dedicated amin element instead of being rendered as
 * plain lyrics. Lyrics are stored one line per `<p>` (see songs slidesMarkdown),
 * but a trailing `<br>`-separated amin inside the last paragraph is handled too.
 * Returns the lyrics WITHOUT the amin line plus the extracted amin text, or
 * `null` when the last line isn't an amin.
 */
export function extractTrailingAmin(
  htmlContent: string,
): { mainText: string; amen: string } | null {
  // Drop trailing empty paragraphs / line breaks / whitespace first.
  const trimmed = htmlContent.replace(
    /(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>|\s)+$/gi,
    '',
  )

  // The last paragraph (lines are one-per-<p>).
  const lastP = trimmed.match(/<p\b[^>]*>((?:(?!<\/p>)[\s\S])*)<\/p>\s*$/i)
  if (!lastP || lastP.index === undefined) return null
  const lastInner = lastP[1]
  const before = trimmed.slice(0, lastP.index)

  // Case A: the whole last paragraph is just an amin.
  const lastText = htmlToPlainText(lastInner)
  if (isAminLine(lastText)) {
    return {
      mainText: before.replace(/(?:<br\s*\/?>|\s)+$/gi, ''),
      amen: lastText,
    }
  }

  // Case B: the last paragraph ends with a <br>-separated amin line.
  const brSplit = lastInner.match(/^([\s\S]*)<br\s*\/?>\s*((?:(?!<br)[\s\S])*)$/i)
  if (brSplit) {
    const head = brSplit[1]
    const tailText = htmlToPlainText(brSplit[2])
    if (isAminLine(tailText) && htmlToPlainText(head).length > 0) {
      const cleanedHead = head.replace(/(?:<br\s*\/?>|\s)+$/gi, '')
      return { mainText: `${before}<p>${cleanedHead}</p>`, amen: tailText }
    }
  }

  return null
}

/**
 * Resolves the lyrics (`mainText`) and the amin value for a song slide. On the
 * last slide, a standalone trailing "amin" line is moved out of the lyrics into
 * the amin element ([[extractTrailingAmin]]); otherwise the lyrics are kept
 * as-is and a standard "Amin!" element is added only when the slide has no
 * "amin" at all (see [[resolveAmen]]).
 */
export function resolveSongSlideBody(
  isLastSlide: boolean,
  slideContent: string,
): { mainText: string; amen: string | undefined } {
  if (!isLastSlide) return { mainText: slideContent, amen: undefined }
  const extracted = extractTrailingAmin(slideContent)
  if (extracted) return extracted
  return { mainText: slideContent, amen: resolveAmen(isLastSlide, slideContent) }
}
