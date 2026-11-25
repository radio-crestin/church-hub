import { parseTemplateJson } from './parseTemplateJson'
import { getDefaultNextSlideConfig } from '../presentation/default-design/getDefaultNextSlideConfig'
import type { NextSlideSectionConfig } from '../presentation/types'

/**
 * The "next slide" strip over its defaults. Nothing stored means the template
 * never had one: it is described but off, so an upgrade never adds a strip
 * nobody asked for.
 */
export function parseNextSlide(json: string): NextSlideSectionConfig {
  const defaults = getDefaultNextSlideConfig()
  const parsed = parseTemplateJson(
    json,
    'next_slide',
  ) as Partial<NextSlideSectionConfig>
  if (Object.keys(parsed).length === 0) return { ...defaults, enabled: false }
  return {
    ...defaults,
    ...parsed,
    labelStyle: { ...defaults.labelStyle, ...parsed.labelStyle },
    contentStyle: { ...defaults.contentStyle, ...parsed.contentStyle },
    background: { ...defaults.background, ...parsed.background },
  }
}
