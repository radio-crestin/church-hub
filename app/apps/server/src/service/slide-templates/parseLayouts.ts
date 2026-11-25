import { parseTemplateJson } from './parseTemplateJson'
import type { TemplateLayouts } from './types'
import { type contentTypes, contentTypes as slideKinds } from '../../db/schema'
import { getDefaultContentConfig } from '../presentation/default-design/getDefaultContentConfig'
import { getMissingContentConfig } from '../presentation/getMissingContentConfig'
import { readLegacyClockFlag } from '../presentation/readLegacyClockFlag'

type SlideKind = (typeof contentTypes)[number]

/**
 * A template's layouts, each merged over its factory default so a layout
 * stored by an older version always has the fields the renderer reads (like
 * `background`). A slide kind the template has no layout for follows its
 * `song` layout (first/last song slides) or gets the factory design.
 */
export function parseLayouts(json: string): TemplateLayouts {
  const stored = parseTemplateJson(json, 'layouts') as Partial<
    Record<SlideKind, Record<string, unknown>>
  >
  const own = (kind: SlideKind) => {
    const layout = stored[kind]
    return layout
      ? { ...getDefaultContentConfig(kind), ...readLegacyClockFlag(layout) }
      : undefined
  }
  const song = own('song')
  const layouts = {} as TemplateLayouts
  for (const kind of slideKinds) {
    layouts[kind] = own(kind) ?? getMissingContentConfig(kind, undefined, song)
  }
  return layouts
}
