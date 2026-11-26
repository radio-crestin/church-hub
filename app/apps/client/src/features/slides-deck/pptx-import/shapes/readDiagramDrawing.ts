import type { PptxShapeContext } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlDescendants } from '../xml/xmlDescendants'

/**
 * The part a SmartArt keeps its drawn shapes in (`ppt/diagrams/drawingN.xml`):
 * named by its data part's `dsp:dataModelExt relId`, else the slide's only
 * diagram drawing; null when the file has none.
 */
export async function readDiagramDrawing(
  graphicData: Element,
  context: PptxShapeContext,
): Promise<{ path: string; tree: Element } | null> {
  const { pkg } = context.deck
  const rels = await pkg.rels(context.partPath)
  const dataId = xmlChild(graphicData, 'relIds')?.getAttribute('r:dm')
  const dataPath = dataId ? rels.get(dataId)?.target : undefined
  const data = dataPath ? await pkg.xml(dataPath) : null
  const relId = xmlDescendants(
    data?.documentElement,
    'dataModelExt',
  )[0]?.getAttribute('relId')
  const drawings = [...rels.values()].filter((r) => r.type === 'diagramDrawing')
  const path =
    (relId ? rels.get(relId)?.target : undefined) ??
    (drawings.length === 1 ? drawings[0]?.target : undefined)
  const doc = path ? await pkg.xml(path) : null
  const tree = xmlChild(doc?.documentElement, 'spTree')
  return path && tree ? { path, tree } : null
}
