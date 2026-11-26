import type { DeckElement, DeckSlideKind } from '../../types'

/** What kind of slide its elements make, as the editor names slides. */
export function slideKind(
  elements: DeckElement[],
  hasTitle: boolean,
): DeckSlideKind {
  const texts = elements.filter((e) => e.type === 'text').length
  if (elements.some((e) => e.type === 'video' && e.w > 0)) return 'video'
  if (hasTitle) return texts > 1 ? 'title_text' : 'title'
  if (!texts && elements.some((e) => e.type === 'image')) return 'picture'
  return 'blank'
}
