import type { PptxPackage } from '../package/openPptxPackage'
import { placeholderOf } from '../shapes/placeholderOf'
import { xmlChild } from '../xml/xmlChild'
import { xmlChildren } from '../xml/xmlChildren'
import { xmlDescendants } from '../xml/xmlDescendants'

/** The deck's longest notes. */
const MAX_NOTES = 20_000

/** A slide's speaker notes: the text of its notes page's body, a line per paragraph. */
export async function readNotes(
  pkg: PptxPackage,
  slidePath: string,
): Promise<string | undefined> {
  const rel = [...(await pkg.rels(slidePath)).values()].find(
    (r) => r.type === 'notesSlide' && !r.external,
  )
  const doc = rel ? await pkg.xml(rel.target) : null
  const body = xmlDescendants(doc?.documentElement, 'sp').find(
    (shape) => placeholderOf(shape)?.getAttribute('type') === 'body',
  )
  const text = xmlChildren(xmlChild(body, 'txBody'), 'p')
    .map((p) =>
      xmlChildren(p)
        .map((part) =>
          part.localName === 'br'
            ? '\n'
            : (xmlChild(part, 't')?.textContent ?? ''),
        )
        .join(''),
    )
    .join('\n')
    .trim()
  return text ? text.slice(0, MAX_NOTES) : undefined
}
