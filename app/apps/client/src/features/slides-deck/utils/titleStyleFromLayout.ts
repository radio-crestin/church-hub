import type { AnnouncementContentConfig } from '~/features/presentation/types'
import type { DeckTextStyle } from '../types'

/** A theme's look when it has none to give (white on black). */
export const DEFAULT_DECK_TEXT_STYLE: DeckTextStyle = {
  fontSize: 88,
  color: '#ffffff',
  bold: false,
  italic: false,
  alignment: 'center',
  background: '#000000',
}

/** What the server takes for a colour (service/slides-deck/deckReader). */
const COLOR =
  /^(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%]+\)|[a-zA-Z]{1,30})$/

/**
 * A deck's title style from a theme's announcement layout (its main text and
 * background), its size scaled from the theme's canvas (`templateWidth`) to a
 * 1920-wide slide. Whatever the layout lacks, or the server would refuse,
 * stays as DEFAULT_DECK_TEXT_STYLE.
 */
export function titleStyleFromLayout(
  layout: AnnouncementContentConfig | undefined,
  templateWidth: number,
): DeckTextStyle {
  const style = layout?.mainText?.style
  if (!style) return DEFAULT_DECK_TEXT_STYLE
  const fontFamily = style.fontFamily?.replace(/[^\w\s,'-]/g, '').trim()
  const background = layout.background
  return {
    fontFamily: fontFamily || undefined,
    fontSize: Math.round((style.maxFontSize * 1920) / (templateWidth || 1920)),
    color: COLOR.test(style.color)
      ? style.color
      : DEFAULT_DECK_TEXT_STYLE.color,
    bold: style.bold,
    italic: style.italic,
    alignment: style.alignment === 'justify' ? 'left' : style.alignment,
    background:
      background?.type === 'color' &&
      background.color &&
      COLOR.test(background.color)
        ? background.color
        : DEFAULT_DECK_TEXT_STYLE.background,
  }
}
