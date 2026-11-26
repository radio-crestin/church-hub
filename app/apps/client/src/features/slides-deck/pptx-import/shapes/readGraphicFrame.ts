import { emptyRead } from './emptyRead'
import { groupTransform } from './groupTransform'
import { readDiagramDrawing } from './readDiagramDrawing'
import { readPic } from './readPic'
import { readShapeTree } from './readShapeTree'
import { readXfrm } from './readXfrm'
import { shapeInfo } from './shapeInfo'
import { tableElement } from './tableElement'
import { toDeckBox } from './toDeckBox'
import type { PptxTransform } from './types'
import type { PptxShapeContext, PptxShapesRead } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlDescendants } from '../xml/xmlDescendants'

/**
 * A graphic frame: a SmartArt as the shapes of its drawing, inside the frame;
 * an OLE object as its preview picture (`picture_fallback`); a table as a
 * text box of its rows. A chart has no picture of its own: it is left out
 * unless the file gives one as a fallback (readShapeTree).
 */
export async function readGraphicFrame(
  frame: Element,
  transform: PptxTransform,
  context: PptxShapeContext,
): Promise<PptxShapesRead> {
  const read = emptyRead()
  const info = shapeInfo(frame)
  const xfrm = xmlChild(frame, 'xfrm')
  const own = readXfrm(xfrm)
  const data = xmlChild(frame, 'graphic', 'graphicData')
  if (info.hidden || !own || !data) return read
  const uri = data.getAttribute('uri') ?? ''
  const id = `${context.idPrefix}${info.id}`

  if (uri.endsWith('/diagram')) {
    const drawing = await readDiagramDrawing(data, context)
    if (!drawing) {
      read.notes.push({
        outcome: 'skipped',
        reason: 'smartart',
        detail: info.name,
      })
      return read
    }
    const inner = await readShapeTree(
      drawing.tree,
      groupTransform(null, own, transform),
      { ...context, partPath: drawing.path, idPrefix: `${id}-` },
    )
    inner.targets.set(
      info.id,
      inner.elements.map((e) => e.id),
    )
    return inner
  }
  if (uri.endsWith('/chart') || uri.includes('chartex')) {
    read.notes.push({ outcome: 'skipped', reason: 'chart', detail: info.name })
    return read
  }
  if (uri.endsWith('/ole')) {
    for (const pic of xmlDescendants(data, 'pic')) {
      const preview = await readPic(pic, transform, context, xfrm)
      const image = preview.elements[0]
      if (image?.type === 'image') {
        read.elements.push({
          id,
          type: 'picture_fallback',
          x: image.x,
          y: image.y,
          w: image.w,
          h: image.h,
          rotation: image.rotation,
          mediaId: image.mediaId,
          reason: 'ole',
        })
        read.targets.set(info.id, [id])
        read.notes.push({
          outcome: 'picture',
          reason: 'ole',
          detail: info.name,
        })
        return read
      }
    }
    read.notes.push({ outcome: 'skipped', reason: 'ole', detail: info.name })
    return read
  }
  const table = xmlChild(data, 'tbl')
  if (table) {
    const text = tableElement(
      table,
      { id, ...toDeckBox(transform(own), context.deck.scale) },
      12_700 * context.deck.scale,
    )
    if (text) {
      read.elements.push(text)
      read.targets.set(info.id, [id])
      read.notes.push({
        outcome: 'changed',
        reason: 'table',
        detail: info.name,
      })
    }
  }
  return read
}
