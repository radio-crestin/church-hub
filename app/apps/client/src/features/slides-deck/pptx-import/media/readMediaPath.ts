import type { PptxShapeContext } from '../slide/types'
import { xmlChild } from '../xml/xmlChild'
import { xmlDescendants } from '../xml/xmlDescendants'

/**
 * Where a video's or sound's file is in the zip: the `p14:media` embed of
 * its picture, else its `a:videoFile`/`a:audioFile` link when that is inside
 * the file; `linked` when it is only a link to a file elsewhere.
 */
export async function readMediaPath(
  pic: Element,
  context: PptxShapeContext,
): Promise<{ path?: string; linked: boolean }> {
  const nvPr = xmlChild(pic, 'nvPicPr', 'nvPr')
  const file = xmlChild(nvPr, 'videoFile') ?? xmlChild(nvPr, 'audioFile')
  const embed = xmlDescendants(
    xmlChild(nvPr, 'extLst'),
    'media',
  )[0]?.getAttribute('r:embed')
  const rels = await context.deck.pkg.rels(context.partPath)
  for (const id of [embed, file?.getAttribute('r:link')]) {
    const rel = id ? rels.get(id) : undefined
    if (rel && !rel.external && context.deck.pkg.has(rel.target)) {
      return { path: rel.target, linked: false }
    }
  }
  return { linked: true }
}
