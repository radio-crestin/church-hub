/**
 * Building blocks of the factory slide design: the bundled fonts, the colour
 * palette and helpers that turn a box on the screen into element configs.
 * Every value is in the units the screen editor uses (% of the screen, px of
 * font at the screen's own size).
 */

/** Fonts bundled with the client (see bundledFonts.ts there). */
export const FONTS = {
  /** Lyrics, scripture, body text: compact, very legible from far away. */
  text: 'Source Sans 3',
  /** References, labels, announcements, clock: strong geometric titles. */
  title: 'Montserrat',
} as const

export const COLORS = {
  text: '#ffffff',
  /** Warm gold for references, the song key and "Amin": hierarchy at a glance. */
  accent: '#f4c86a',
  /** Secondary labels (who reads, next slide). */
  muted: '#cbd3de',
  background: '#000000',
} as const

type Unit = '%' | 'px'

/** Distances from the screen edges, in % of the screen. */
export interface Box {
  top: number
  right: number
  bottom: number
  left: number
}

export interface TextSlot {
  box: Box
  maxFontSize: number
  alignment: 'left' | 'center' | 'right'
  verticalAlignment?: 'top' | 'middle' | 'bottom'
  hidden?: boolean
}

function edge(value: number, unit: Unit = '%') {
  return { enabled: true, value, unit }
}

/** Constraints pinned to all four edges plus the matching size, so the editor shows the same box. */
export function boxPlacement(box: Box) {
  return {
    constraints: {
      top: edge(box.top),
      right: edge(box.right),
      bottom: edge(box.bottom),
      left: edge(box.left),
    },
    size: {
      width: 100 - box.left - box.right,
      widthUnit: '%' as Unit,
      height: 100 - box.top - box.bottom,
      heightUnit: '%' as Unit,
    },
  }
}

export function textStyle(overrides: Record<string, unknown> = {}) {
  return {
    fontFamily: FONTS.text,
    maxFontSize: 100,
    autoScale: true,
    color: COLORS.text,
    bold: false,
    italic: false,
    underline: false,
    alignment: 'center',
    verticalAlignment: 'middle',
    lineHeight: 1.2,
    shadow: false,
    compressLines: false,
    lineSeparator: 'space',
    ...overrides,
  }
}

export function fadeIn() {
  return { type: 'fade', duration: 300, delay: 0, easing: 'ease-out' }
}

export function fadeOut() {
  return { type: 'fade', duration: 200, delay: 0, easing: 'ease-in' }
}

/** A text element placed in `slot`, styled by `style` on top of the shared defaults. */
export function textElement(
  slot: TextSlot,
  style: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    ...boxPlacement(slot.box),
    style: textStyle({
      maxFontSize: slot.maxFontSize,
      alignment: slot.alignment,
      verticalAlignment: slot.verticalAlignment ?? 'middle',
      ...style,
    }),
    animationIn: fadeIn(),
    animationOut: fadeOut(),
    ...(slot.hidden ? { hidden: true } : {}),
    ...extra,
  }
}
