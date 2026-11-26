import { asPictureFallback } from './asPictureFallback'
import { emptyRead } from './emptyRead'
import { readShapeTree } from './readShapeTree'
import type { PptxTransform } from './types'
import type { PptxShapeContext, PptxShapesRead } from '../slide/types'
import { xmlChildren } from '../xml/xmlChildren'

const STANDS_IN = new Set(['chart', 'smartart', 'ole'])

/**
 * Markup with alternatives (`mc:AlternateContent`): the first `mc:Choice`
 * read without leaving anything out, else its `mc:Fallback`. A fallback
 * picture of a chart, SmartArt or OLE object stands in for it.
 */
export async function readAlternateContent(
  alternate: Element,
  transform: PptxTransform,
  context: PptxShapeContext,
): Promise<PptxShapesRead> {
  const candidates = [
    ...xmlChildren(alternate, 'Choice'),
    ...xmlChildren(alternate, 'Fallback'),
  ]
  const reads: PptxShapesRead[] = []
  for (const candidate of candidates) {
    const read = await readShapeTree(candidate, transform, context)
    if (!read.notes.some((note) => note.outcome === 'skipped')) {
      const first = reads[0]?.notes.find(
        (note) => note.outcome === 'skipped' && STANDS_IN.has(note.reason),
      )
      return first
        ? asPictureFallback(
            read,
            first.reason as 'chart' | 'smartart' | 'ole',
            first.detail,
          )
        : read
    }
    reads.push(read)
  }
  return reads[reads.length - 1] ?? emptyRead()
}
