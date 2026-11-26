import { getFactoryDesign } from './getFactoryDesign'
import { THEME_BACKGROUNDS_URL_PREFIX } from './theme-backgrounds/constants'
import type { TemplateDesign } from './types'
import { boxPlacement } from '../presentation/default-design/designPrimitives'

/** A photo or a looping video the theme ships with, darkened over black. */
export interface ThemeMedia {
  /** A file of `tauri/resources/theme-backgrounds`. */
  file: string
  /** How much of it shows over black: lower is darker, for readable text. */
  opacity: number
}

/** The look of a theme: its background, its colours and its font. */
export interface Palette {
  /** A colour, or a photo or video. */
  background: string | ThemeMedia
  text: string
  /** The reference, a song's key, title and Amen. */
  accent: string
  fontFamily: string
  italic: boolean
  /** Bold words with a soft shadow, readable on a photo or a video. */
  onMedia?: boolean
  /**
   * The verses and announcements type themselves in, left-aligned like a
   * typed page; songs still fade, so the congregation can sing at once.
   */
  typewriter?: boolean
}

type Layout = Record<string, unknown>
type Element = Record<string, unknown> & { style: Record<string, unknown> }

/** The verse centred, the reference under it, a calm fade, no clock. */
const VERSE_BOX = { top: 14, right: 12, bottom: 30, left: 12 }
const REFERENCE_BOX = { top: 74, right: 12, bottom: 14, left: 12 }
const FADE = { type: 'fade', duration: 900, delay: 0, easing: 'ease-in-out' }
/** At most 3.5 s per slide: a short verse types at a calm pace, a long one faster. */
const TYPEWRITER = {
  type: 'typewriter',
  duration: 3500,
  delay: 0,
  easing: 'linear',
}
/** The slide before a typed one clears quickly, so the new words type on a clear page. */
const QUICK_FADE = {
  type: 'fade',
  duration: 250,
  delay: 0,
  easing: 'ease-out',
}

/** How a text comes in and changes: typed in, or the theme's calm fade. */
function transitionsOf(palette: Palette) {
  return palette.typewriter
    ? {
        animationIn: TYPEWRITER,
        animationOut: FADE,
        slideTransitionIn: TYPEWRITER,
        slideTransitionOut: QUICK_FADE,
      }
    : {
        animationIn: FADE,
        animationOut: FADE,
        slideTransitionIn: FADE,
        slideTransitionOut: FADE,
      }
}

function restyle(element: unknown, style: Record<string, unknown>): Element {
  const own = element as Element
  return { ...own, style: { ...own.style, ...style } }
}

function backgroundOf(palette: Palette) {
  const { background } = palette
  if (typeof background === 'string') {
    return { type: 'color', color: background, opacity: 1 }
  }
  const url = `${THEME_BACKGROUNDS_URL_PREFIX}/${background.file}`
  return background.file.endsWith('.mp4')
    ? {
        type: 'video',
        videoUrl: url,
        color: '#000000',
        opacity: background.opacity,
      }
    : {
        type: 'image',
        imageUrl: url,
        color: '#000000',
        opacity: background.opacity,
      }
}

function verseText(element: unknown, palette: Palette): Element {
  return {
    ...restyle(element, {
      fontFamily: palette.fontFamily,
      italic: palette.italic,
      bold: !!palette.onMedia,
      color: palette.text,
      alignment: palette.typewriter ? 'left' : 'center',
      verticalAlignment: 'middle',
      lineHeight: 1.35,
      maxFontSize: 96,
      shadow: !!palette.onMedia,
    }),
    ...boxPlacement(VERSE_BOX),
    ...transitionsOf(palette),
  }
}

function reference(element: unknown, palette: Palette): Element {
  return {
    ...restyle(element, {
      fontFamily: 'Montserrat',
      italic: false,
      bold: true,
      color: palette.accent,
      alignment: palette.typewriter ? 'left' : 'center',
      verticalAlignment: 'top',
      maxFontSize: 44,
      autoScale: false,
      shadow: !!palette.onMedia,
    }),
    ...boxPlacement(REFERENCE_BOX),
    animationIn: FADE,
    animationOut: FADE,
  }
}

/**
 * A design from a palette: the classic layouts in its colours, font and
 * background, with the verses (Bible verse, passage, verse lists) centred and
 * their reference under them, songs and announcements in the same look. On a
 * photo or video the words are bold with a soft shadow, like a projection
 * program's worship themes.
 */
export function getPaletteDesign(palette: Palette): TemplateDesign {
  const design = getFactoryDesign('primary')
  const background = backgroundOf(palette)
  const layouts = Object.fromEntries(
    Object.entries(design.layouts).map(([kind, layout]) => [
      kind,
      { ...layout, background, clockEnabled: false },
    ]),
  ) as unknown as TemplateDesign['layouts']

  for (const kind of ['bible', 'bible_passage', 'versete_tineri'] as const) {
    const layout = layouts[kind] as Layout
    layouts[kind] = {
      ...layout,
      contentText: verseText(layout.contentText, palette),
      referenceText: reference(layout.referenceText, palette),
      ...(layout.personLabel
        ? { personLabel: { ...(layout.personLabel as Layout), hidden: true } }
        : {}),
      includeReferenceInContent: kind === 'versete_tineri' ? undefined : false,
    }
  }
  // Songs and announcements shown in between read in the same palette.
  const textKinds = [
    'song',
    'song_first_slide',
    'song_last_slide',
    'announcement',
  ] as const
  for (const kind of textKinds) {
    const layout = layouts[kind] as Layout
    const accented = Object.fromEntries(
      ['songKey', 'amen', 'songTitle']
        .filter((name) => layout[name])
        .map((name) => [
          name,
          restyle(layout[name], {
            color: palette.accent,
            shadow: !!palette.onMedia,
          }),
        ]),
    )
    const typed = palette.typewriter && kind === 'announcement'
    layouts[kind] = {
      ...layout,
      ...accented,
      mainText: {
        ...restyle(layout.mainText, {
          fontFamily: palette.fontFamily,
          color: palette.text,
          ...(palette.onMedia && { bold: true }),
          shadow: !!palette.onMedia,
        }),
        ...(typed
          ? transitionsOf(palette)
          : { slideTransitionIn: FADE, slideTransitionOut: FADE }),
      },
    }
  }
  return {
    ...design,
    layouts,
    globalSettings: {
      ...design.globalSettings,
      defaultBackground:
        background as TemplateDesign['globalSettings']['defaultBackground'],
    },
  }
}
