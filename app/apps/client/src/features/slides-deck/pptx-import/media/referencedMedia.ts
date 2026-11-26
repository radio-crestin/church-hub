import type { SlideDeck } from '../../types'

/** Every media id a deck's slides refer to: backgrounds, pictures, videos and posters. */
export function referencedMedia(deck: SlideDeck): Set<string> {
  const ids = new Set<string>()
  for (const slide of deck.slides) {
    const background = slide.background
    if (background && background.type !== 'color') ids.add(background.mediaId)
    for (const element of slide.elements) {
      if ('mediaId' in element) ids.add(element.mediaId)
      if (element.type === 'video' && element.posterMediaId) {
        ids.add(element.posterMediaId)
      }
    }
  }
  return ids
}
