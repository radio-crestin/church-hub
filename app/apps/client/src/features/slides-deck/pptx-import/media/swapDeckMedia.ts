import type { DeckElement, SlideDeck } from '../../types'

/**
 * The deck with each media token swapped for its uploaded gallery id; what
 * refers to a file that did not upload is left out (a poster just goes, a
 * background turns white).
 */
export function swapDeckMedia(
  deck: SlideDeck,
  uploaded: Map<string, string>,
): SlideDeck {
  const slides = deck.slides.map((slide) => {
    const elements = slide.elements.flatMap((element): DeckElement[] => {
      if (!('mediaId' in element)) return [element]
      const mediaId = uploaded.get(element.mediaId)
      if (!mediaId) return []
      if (element.type !== 'video') return [{ ...element, mediaId }]
      const poster = element.posterMediaId
        ? uploaded.get(element.posterMediaId)
        : undefined
      return [{ ...element, mediaId, posterMediaId: poster }]
    })
    const background = slide.background
    let swappedBackground = background
    if (background && background.type !== 'color') {
      const mediaId = uploaded.get(background.mediaId)
      swappedBackground = mediaId
        ? { ...background, mediaId }
        : { type: 'color', color: '#ffffff' }
    }
    const kept = new Set(
      elements.flatMap((e) => (e.animations ?? []).map((a) => a.id)),
    )
    return {
      ...slide,
      background: swappedBackground,
      elements,
      animationOrder: slide.animationOrder?.filter((id) => kept.has(id)),
    }
  })
  return { ...deck, slides }
}
