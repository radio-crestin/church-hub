import { appendRead } from './appendRead'
import { emptyRead } from './emptyRead'
import { groupTransform } from './groupTransform'
import { readAlternateContent } from './readAlternateContent'
import { readGraphicFrame } from './readGraphicFrame'
import { readPic } from './readPic'
import { readSp } from './readSp'
import { readXfrm } from './readXfrm'
import { shapeInfo } from './shapeInfo'
import type { PptxTransform } from './types'
import type { PptxShapeContext, PptxShapesRead } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'

/**
 * The shapes of a shape tree (`p:spTree`, a group, a SmartArt drawing) as
 * deck elements in drawing order, groups flattened into slide coordinates;
 * an animation aimed at a group plays on all of its elements.
 */
export async function readShapeTree(
  tree: Element,
  transform: PptxTransform,
  context: PptxShapeContext,
): Promise<PptxShapesRead> {
  const read = emptyRead()
  for (const child of xmlChildren(tree)) {
    switch (child.localName) {
      case 'sp':
      case 'cxnSp':
        appendRead(read, await readSp(child, transform, context))
        break
      case 'pic':
        appendRead(read, await readPic(child, transform, context))
        break
      case 'graphicFrame':
        appendRead(read, await readGraphicFrame(child, transform, context))
        break
      case 'AlternateContent':
        appendRead(read, await readAlternateContent(child, transform, context))
        break
      case 'grpSp': {
        const info = shapeInfo(child)
        const xfrm = xmlChild(child, 'grpSpPr', 'xfrm')
        const box = readXfrm(xfrm)
        if (info.hidden || !box) break
        const group = await readShapeTree(
          child,
          groupTransform(xfrm, box, transform),
          context,
        )
        group.targets.set(
          info.id,
          group.elements.map((e) => e.id),
        )
        appendRead(read, group)
        break
      }
    }
  }
  return read
}
