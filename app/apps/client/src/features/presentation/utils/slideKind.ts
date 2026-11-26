import { contentFamily } from './contentFamily'
import type { ContentType, ScreenWithConfigs } from '../types'

/**
 * What kind of slide a content is: its content family drawn with its
 * template. Slides of one kind change as slides (crossfade, line morph); a new
 * kind replaces the slide (useContentTypeHandoff). Null for the empty screen.
 */
export function slideKind(
  contentType: ContentType,
  screen: ScreenWithConfigs | null | undefined,
): string | null {
  if (contentType === 'empty') return null
  return slideLayerKey(contentType, screen)
}

/** The React key of a slide's layer (ScreenContentLayers): one per kind. */
export function slideLayerKey(
  contentType: ContentType,
  screen: ScreenWithConfigs | null | undefined,
): string {
  return `${contentFamily(contentType)}|${screen?.templateId ?? ''}`
}
