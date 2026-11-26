import type { PptxPart, PptxSlideParts } from './types'
import type { PptxPackage } from '../package/openPptxPackage'
import { readTheme } from '../theme/readTheme'
import type { PptxTheme } from '../theme/types'
import { xmlChild } from '../xml/xmlChild'

/** The part a relationship of type `type` of `from` points to. */
async function related(
  pkg: PptxPackage,
  from: PptxPart | null,
  type: string,
): Promise<PptxPart | null> {
  if (!from) return null
  const rel = [...(await pkg.rels(from.path)).values()].find(
    (r) => r.type === type && !r.external,
  )
  const doc = rel ? await pkg.xml(rel.target) : null
  return rel && doc ? { path: rel.target, doc } : null
}

/** A colour map's attributes (`bg1="lt1"` …) as a map. */
function colorMapOf(element: Element | null): Record<string, string> | null {
  if (!element) return null
  return Object.fromEntries(
    Array.from(element.attributes).map((a) => [a.localName, a.value]),
  )
}

const themes = new WeakMap<Document, PptxTheme>()

/**
 * A slide with the layout and master it is built on, its theme, and its
 * colour map: the master's `p:clrMap`, unless the slide or its layout
 * overrides it.
 */
export async function readSlideParts(
  pkg: PptxPackage,
  slide: PptxPart,
  number: number,
): Promise<PptxSlideParts> {
  const layout = await related(pkg, slide, 'slideLayout')
  const master = await related(pkg, layout, 'slideMaster')
  const themePart = await related(pkg, master, 'theme')
  let theme = themePart ? themes.get(themePart.doc) : undefined
  if (!theme) {
    theme = readTheme(themePart?.doc ?? null)
    if (themePart) themes.set(themePart.doc, theme)
  }
  const override = (part: PptxPart | null) =>
    colorMapOf(
      xmlChild(part?.doc.documentElement, 'clrMapOvr', 'overrideClrMapping'),
    )
  const colorMap = override(slide) ??
    override(layout) ??
    colorMapOf(xmlChild(master?.doc.documentElement, 'clrMap')) ?? {
      bg1: 'lt1',
      tx1: 'dk1',
      bg2: 'lt2',
      tx2: 'dk2',
    }
  return {
    number,
    slide,
    layout,
    master,
    theme,
    color: { theme, colorMap },
  }
}
