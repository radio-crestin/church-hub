import type { ContentTypeConfig } from '../../../types'
import type { ContentData } from '../types'

/** Every element that draws words from the content onto the screen. */
const TEXT_ELEMENTS = [
  'mainText',
  'contentText',
  'referenceText',
  'songKey',
  'amen',
  'personLabel',
] as const

/**
 * Whether the renderer is drawing any of the content's text right now. It asks
 * what each text element asks of itself before it shows: the content type's
 * layout has the element and does not hide it, and the content is visible and
 * carries that text. A scene or a blank slide has no such element, so it
 * counts as no text even while it is on screen.
 */
export function hasVisibleText(
  config: ContentTypeConfig | undefined,
  contentData: ContentData | null,
  isVisible: boolean,
): boolean {
  if (!isVisible || !config || !contentData) return false

  const elements = config as Partial<
    Record<(typeof TEXT_ELEMENTS)[number], { hidden?: boolean } | undefined>
  >
  return TEXT_ELEMENTS.some((key) => {
    const element = elements[key]
    return !!element && !element.hidden && !!contentData[key]
  })
}
