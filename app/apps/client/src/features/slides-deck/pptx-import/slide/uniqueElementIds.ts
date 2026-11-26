import type { DeckElement } from '../../types'

/** Elements with ids of their own on the slide (a broken file can repeat a shape id). */
export function uniqueElementIds(elements: DeckElement[]): DeckElement[] {
  const seen = new Set<string>()
  return elements.map((element) => {
    let id = element.id
    for (let n = 2; seen.has(id); n += 1) id = `${element.id}-${n}`
    seen.add(id)
    return id === element.id ? element : { ...element, id }
  })
}
