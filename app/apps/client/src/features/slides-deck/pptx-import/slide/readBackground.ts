import type { PptxDeckContext, PptxShapeNote, PptxSlideParts } from './types'
import type { DeckBackground } from '../../types'
import { readBlip } from '../media/readBlip'
import { readFill } from '../shapes/readFill'
import { type PptxFill, readFillElement } from '../shapes/readFillElement'
import { colorCss } from '../theme/colorCss'
import { resolveColor } from '../theme/resolveColor'
import { xmlChild } from '../xml/xmlChild'
import { xmlNumber } from '../xml/xmlNumber'

/** A `p:bg`'s fill: its own (`p:bgPr`) or the theme's it refers to (`p:bgRef`). */
function backgroundFill(
  bg: Element,
  parts: PptxSlideParts,
): PptxFill | undefined {
  const own = readFill(xmlChild(bg, 'bgPr'), parts.color)
  if (own) return own
  const ref = xmlChild(bg, 'bgRef')
  const idx = xmlNumber(ref, 'idx') ?? 0
  const placeholderColor = resolveColor(ref, parts.color) ?? undefined
  const { theme } = parts
  const entry =
    idx >= 1001 ? theme.backgroundFills[idx - 1001] : theme.fills[idx - 1]
  if (entry) {
    return readFillElement(entry, { ...parts.color, placeholderColor })
  }
  return placeholderColor
    ? { kind: 'color', color: placeholderColor }
    : undefined
}

/**
 * A slide's background: its own `p:bg`, else its layout's, else its
 * master's. A colour, a gradient as its first colour, a picture filling the
 * slide; white when none of them sets one.
 */
export async function readBackground(
  parts: PptxSlideParts,
  deck: PptxDeckContext,
): Promise<{ background: DeckBackground; notes: PptxShapeNote[] }> {
  for (const part of [parts.slide, parts.layout, parts.master]) {
    const bg = xmlChild(part?.doc.documentElement, 'cSld', 'bg')
    if (!part || !bg) continue
    const fill = backgroundFill(bg, parts)
    if (!fill) continue
    if (fill.kind === 'picture') {
      const blip = await readBlip(
        fill.blipFill,
        { deck, parts, partPath: part.path, level: 'slide', idPrefix: '' },
        '',
      )
      if (blip.mediaId) {
        return {
          background: { type: 'image', mediaId: blip.mediaId, fit: 'cover' },
          notes: [],
        }
      }
      return {
        background: { type: 'color', color: '#ffffff' },
        notes: blip.note ? [blip.note] : [],
      }
    }
    if (fill.kind === 'none') break
    return {
      background: { type: 'color', color: colorCss(fill.color) },
      notes:
        fill.kind === 'gradient'
          ? [{ outcome: 'changed', reason: 'gradient' }]
          : [],
    }
  }
  return { background: { type: 'color', color: '#ffffff' }, notes: [] }
}
