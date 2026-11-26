import type { PptxShapesRead } from '../slide/types'

/** Shapes read: none yet. */
export function emptyRead(): PptxShapesRead {
  return { elements: [], notes: [], targets: new Map() }
}
