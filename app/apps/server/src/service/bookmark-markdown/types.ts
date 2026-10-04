/**
 * One run of styling over plain text, by character offset.
 *
 * The shape the live slide (`TextStyleRange`) and song slides
 * (`SlideStyleRange`) already use, minus what Markdown does not carry
 * (ids, font size).
 */
export interface MarkdownStyleRange {
  start: number
  end: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  /** Background colour, e.g. `#FFFF00`. */
  highlight?: string
}

/** Plain text plus the styling drawn over it. */
export interface StyledText {
  text: string
  ranges: MarkdownStyleRange[]
}

/**
 * The highlight colour the live slide uses. Written as a bare `<mark>`; any
 * other colour carries `style="background-color: …"`. `==text==` reads back
 * as this colour too.
 */
export const DEFAULT_HIGHLIGHT_COLOR = '#FFFF00'
