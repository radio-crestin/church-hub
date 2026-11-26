import { applyColorMods } from './applyColorMods'
import type { PptxColorContext, PptxRgba } from './types'
import { xmlChildren } from '../xml/xmlChildren'

const PRESET_COLORS: Record<string, string> = {
  black: '000000',
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  gray: '808080',
  grey: '808080',
  orange: 'FFA500',
  purple: '800080',
}

const COLOR_ELEMENTS = new Set([
  'srgbClr',
  'schemeClr',
  'sysClr',
  'prstClr',
  'scrgbClr',
])

function hexToRgba(hex: string): PptxRgba {
  const n = Number.parseInt(hex.slice(0, 6), 16) || 0
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
}

function baseColor(
  element: Element,
  context: PptxColorContext,
): PptxRgba | null {
  const value = element.getAttribute('val') ?? ''
  switch (element.localName) {
    case 'srgbClr':
      return hexToRgba(value)
    case 'sysClr':
      return hexToRgba(element.getAttribute('lastClr') ?? '000000')
    case 'prstClr':
      return hexToRgba(PRESET_COLORS[value] ?? '000000')
    case 'scrgbClr': {
      const channel = (name: string) =>
        Math.round(
          Math.min(1, Number(element.getAttribute(name) ?? 0) / 100_000) * 255,
        )
      return { r: channel('r'), g: channel('g'), b: channel('b'), a: 1 }
    }
    case 'schemeClr': {
      if (value === 'phClr') return context.placeholderColor ?? null
      const name = context.colorMap[value] ?? value
      const hex = context.theme.colors[name]
      return hex ? hexToRgba(hex) : null
    }
    default:
      return null
  }
}

/**
 * The colour inside a fill or colour element (`a:solidFill`, a stop, a style
 * reference): sRGB, a scheme colour through the master's colour map, a system
 * or preset colour, with its modifiers applied; null when it has none.
 */
export function resolveColor(
  container: Element | null | undefined,
  context: PptxColorContext,
): PptxRgba | null {
  const element = xmlChildren(container).find((child) =>
    COLOR_ELEMENTS.has(child.localName),
  )
  if (!element) return null
  const base = baseColor(element, context)
  return base ? applyColorMods(base, element) : null
}
