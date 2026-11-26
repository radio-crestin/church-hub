import { deckShapeOf } from './deckShapeOf'
import { emptyRead } from './emptyRead'
import { inheritedPlaceholders } from './inheritedPlaceholders'
import { placeholderOf } from './placeholderOf'
import { readFill } from './readFill'
import { readLine } from './readLine'
import { readStyleRef } from './readStyleRef'
import { readTextElement } from './readTextElement'
import { readXfrm } from './readXfrm'
import { shapeInfo } from './shapeInfo'
import { toDeckBox } from './toDeckBox'
import type { PptxTransform } from './types'
import type { DeckElement, DeckShapeElement } from '../../types'
import { readBlip } from '../media/readBlip'
import type { PptxShapeContext, PptxShapesRead } from '../slide/types'
import { colorCss } from '../theme/colorCss'
import { xmlChild } from '../xml/xmlChild'

/**
 * A shape (`p:sp`, a connector `p:cxnSp`, a SmartArt drawing's `dsp:sp`):
 * its outline and fill as a deck shape (a picture fill as a picture), its
 * text as a text box over it, at its place on the slide. A placeholder takes
 * its place, look and frame from the layout and master; an empty one, and
 * any placeholder of a layout or master, is left out, as a show does.
 */
export async function readSp(
  shape: Element,
  transform: PptxTransform,
  context: PptxShapeContext,
): Promise<PptxShapesRead> {
  const read = emptyRead()
  const info = shapeInfo(shape)
  const ph = placeholderOf(shape)
  if (info.hidden || (ph && context.level !== 'slide')) return read

  const inherited = inheritedPlaceholders(shape, context)
  const spPr = xmlChild(shape, 'spPr')
  const xfrm =
    xmlChild(spPr, 'xfrm') ??
    xmlChild(inherited.layout, 'spPr', 'xfrm') ??
    xmlChild(inherited.master, 'spPr', 'xfrm')
  const own = readXfrm(xfrm)
  if (!own) return read
  const box = transform(own)
  const { scale } = context.deck
  const deckBox = toDeckBox(box, scale)
  const color = context.parts.color
  const refs = readStyleRef(shape, color)
  const fill =
    readFill(spPr, color) ??
    readFill(xmlChild(inherited.layout, 'spPr'), color) ??
    readFill(xmlChild(inherited.master, 'spPr'), color) ??
    refs.fill
  const ownLine = readLine(spPr, color)
  const line = ownLine === undefined ? refs.line : ownLine
  const id = `${context.idPrefix}${info.id}`
  const elements: DeckElement[] = []

  if (fill?.kind === 'picture') {
    const blip = await readBlip(fill.blipFill, context, info.name)
    if (blip.note) read.notes.push(blip.note)
    if (blip.mediaId) {
      elements.push({
        id,
        type: 'image',
        ...deckBox,
        mediaId: blip.mediaId,
        fit: 'fill',
        crop: blip.crop,
        opacity: blip.opacity,
      })
    }
  } else if ((fill && fill.kind !== 'none') || line) {
    const connector = shape.localName === 'cxnSp'
    const geometry =
      xmlChild(spPr, 'prstGeom')?.getAttribute('prst') ?? 'custom'
    const mapped = deckShapeOf(geometry, connector)
    if (!mapped) {
      read.notes.push({
        outcome: 'changed',
        reason: 'shape',
        detail: info.name,
      })
    }
    if (fill?.kind === 'gradient') {
      read.notes.push({
        outcome: 'changed',
        reason: 'gradient',
        detail: info.name,
      })
    }
    const element: DeckShapeElement = {
      id,
      type: 'shape',
      ...deckBox,
      shape: mapped ?? 'rect',
      fill:
        fill && (fill.kind === 'color' || fill.kind === 'gradient')
          ? colorCss(fill.color)
          : mapped === 'line'
            ? undefined
            : 'transparent',
      stroke: line ? colorCss(line.color) : undefined,
      strokeWidth: line
        ? Math.max(1, Math.round(line.widthEmu * scale * 100) / 100)
        : 0,
    }
    // A line runs corner to corner: a flip turns it the other way.
    if (element.shape === 'line' && box.flipH !== box.flipV) {
      const angle = (Math.atan2(element.h, element.w) * 180) / Math.PI
      element.rotation =
        Math.round(((element.rotation ?? 0) - 2 * angle) * 100) / 100
    }
    if (element.shape === 'triangle' && box.flipV) {
      element.rotation = ((element.rotation ?? 0) + 180) % 360
    }
    elements.push(element)
  }

  const text = readTextElement(
    shape,
    inherited,
    { id: elements.length ? `${id}-text` : id, ...deckBox },
    context,
    refs.fontColor,
  )
  // An empty placeholder shows nothing in a show, not even its fill.
  if (ph && !text && fill?.kind !== 'picture') return emptyRead()
  if (text) elements.push(text)
  read.elements.push(...elements)
  if (elements.length)
    read.targets.set(
      info.id,
      elements.map((e) => e.id),
    )
  return read
}
