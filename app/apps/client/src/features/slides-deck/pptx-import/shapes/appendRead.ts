import type { PptxShapesRead } from '../slide/types'

/** Adds what `more` read to `into`: its elements over the ones before. */
export function appendRead(into: PptxShapesRead, more: PptxShapesRead): void {
  into.elements.push(...more.elements)
  into.notes.push(...more.notes)
  for (const [id, elements] of more.targets) into.targets.set(id, elements)
}
