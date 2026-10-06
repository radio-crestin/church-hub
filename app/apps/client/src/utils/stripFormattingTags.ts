// Same rules as the server's apps/server/src/service/songs/text/stripFormattingTags.ts
// (the strip_song_formatting_tags migration): change both together.

/** Inline formatting tags songs should not carry (structure like <p>/<br> stays). */
const FORMATTING_TAG_NAMES =
  'b|i|u|s|em|strong|strike|del|ins|mark|small|big|font|span|sup|sub'

/** `<` as markup or as escaped text: `&lt;`, `&amp;lt;`, `&#60;`, `&#x3c;`. */
const TAG_OPEN = '(?:<|&(?:amp;)*(?:lt|#0*60|#x0*3c);)'
const TAG_CLOSE = '(?:>|&(?:amp;)*(?:gt|#0*62|#x0*3e);)'

const FORMATTING_TAG = new RegExp(
  `${TAG_OPEN}/?(?:${FORMATTING_TAG_NAMES})` +
    `(?:\\s(?:(?!${TAG_CLOSE})[^<>])*)?\\s*/?\\s*${TAG_CLOSE}`,
  'gi',
)

/**
 * Removes inline formatting tags (`<i>`, `<b>`, `<span style=…>`, …) and
 * keeps their text. Matches them both as real markup and as escaped text
 * (`&lt;i&gt;`, `&amp;lt;b&amp;gt;`), which is how a tag typed into a source
 * file ends up stored in slide HTML. Runs until nothing changes, so a removal
 * can never leave a new tag behind.
 */
export function stripFormattingTags(text: string): string {
  let previous: string
  let result = text
  do {
    previous = result
    result = result.replace(FORMATTING_TAG, '')
  } while (result !== previous)
  return result
}
