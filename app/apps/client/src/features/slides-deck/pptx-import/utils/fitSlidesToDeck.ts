import type { DeckElement, DeckSlide, SlideDeck } from '../../types'

const round = (value: number) => Math.round(value * 100) / 100

/**
 * An imported deck's slides laid out on another deck's design size: scaled
 * evenly to fit and centred, their text sizes, insets and outlines scaled
 * with them (text inside a box is sized in em of its box, so it follows).
 */
export function fitSlidesToDeck(
  from: SlideDeck,
  to: Pick<SlideDeck, 'width' | 'height'>,
): DeckSlide[] {
  if (from.width === to.width && from.height === to.height) return from.slides
  const scale = Math.min(to.width / from.width, to.height / from.height)
  const dx = (to.width - from.width * scale) / 2
  const dy = (to.height - from.height * scale) / 2
  const fit = (element: DeckElement): DeckElement => {
    const box = {
      ...element,
      x: round(element.x * scale + dx),
      y: round(element.y * scale + dy),
      w: round(element.w * scale),
      h: round(element.h * scale),
    }
    if (box.type === 'text') {
      return {
        ...box,
        fontSize: box.fontSize && round(box.fontSize * scale),
        padding: box.padding && round(box.padding * scale),
      }
    }
    if (box.type === 'shape' && box.strokeWidth) {
      return { ...box, strokeWidth: round(box.strokeWidth * scale) }
    }
    return box
  }
  return from.slides.map((slide) => ({
    ...slide,
    elements: slide.elements.map(fit),
  }))
}
