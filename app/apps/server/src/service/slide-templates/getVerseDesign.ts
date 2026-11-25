import { getFactoryDesign } from './getFactoryDesign'
import type { TemplateDesign } from './types'
import { boxPlacement } from '../presentation/default-design/designPrimitives'

/** The look of a design made for looping verses before and between services. */
export interface VersePalette {
  background: string
  text: string
  /** The reference under the verse. */
  accent: string
  fontFamily: string
  italic: boolean
}

type Layout = Record<string, unknown>
type Element = Record<string, unknown> & { style: Record<string, unknown> }

/** The verse centred, the reference under it, a calm fade, no clock. */
const VERSE_BOX = { top: 14, right: 12, bottom: 30, left: 12 }
const REFERENCE_BOX = { top: 74, right: 12, bottom: 14, left: 12 }
const FADE = { type: 'fade', duration: 900, delay: 0, easing: 'ease-in-out' }

function restyle(element: unknown, style: Record<string, unknown>): Element {
  const own = element as Element
  return { ...own, style: { ...own.style, ...style } }
}

function verseText(element: unknown, palette: VersePalette): Element {
  return {
    ...restyle(element, {
      fontFamily: palette.fontFamily,
      italic: palette.italic,
      bold: false,
      color: palette.text,
      alignment: 'center',
      verticalAlignment: 'middle',
      lineHeight: 1.35,
      maxFontSize: 96,
      shadow: false,
    }),
    ...boxPlacement(VERSE_BOX),
    animationIn: FADE,
    animationOut: FADE,
    slideTransitionIn: FADE,
    slideTransitionOut: FADE,
  }
}

function reference(element: unknown, palette: VersePalette): Element {
  return {
    ...restyle(element, {
      fontFamily: 'Montserrat',
      italic: false,
      bold: true,
      color: palette.accent,
      alignment: 'center',
      verticalAlignment: 'top',
      maxFontSize: 44,
      autoScale: false,
      shadow: false,
    }),
    ...boxPlacement(REFERENCE_BOX),
    animationIn: FADE,
    animationOut: FADE,
  }
}

/**
 * A design for verse loops: the classic layouts in the palette, with the
 * verses (Bible verse, passage, verse lists) centred and their reference
 * under them.
 */
export function getVerseDesign(palette: VersePalette): TemplateDesign {
  const design = getFactoryDesign('primary')
  const background = { type: 'color', color: palette.background, opacity: 1 }
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
  for (const kind of ['song', 'announcement'] as const) {
    const layout = layouts[kind] as Layout
    layouts[kind] = {
      ...layout,
      mainText: restyle(layout.mainText, {
        fontFamily: palette.fontFamily,
        color: palette.text,
        shadow: false,
      }),
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
