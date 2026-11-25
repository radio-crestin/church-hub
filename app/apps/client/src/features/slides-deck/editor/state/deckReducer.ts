import type { DeckElement, DeckSlide, SlideDeck } from '../../types'
import { newDeckId } from '../../utils/newDeckId'
import type { DeckAction } from '../types'
import { moveItem } from '../utils/moveItem'
import { orderedAnimationIds } from '../utils/orderedAnimationIds'
import { withFreshIds } from '../utils/withFreshIds'

/** The deck with one slide changed by `change`. */
function onSlide(
  deck: SlideDeck,
  slideId: string,
  change: (slide: DeckSlide) => DeckSlide,
): SlideDeck {
  return {
    ...deck,
    slides: deck.slides.map((s) => (s.id === slideId ? change(s) : s)),
  }
}

/** A slide with each element changed by `change`. */
function onElements(
  slide: DeckSlide,
  change: (element: DeckElement) => DeckElement,
): DeckSlide {
  return { ...slide, elements: slide.elements.map(change) }
}

/**
 * The deck after one editor change: slides added, copied, removed, moved or
 * changed; elements inserted, changed, removed or moved up and down the
 * stack; animations added, changed, removed or moved in the slide's play
 * order (written to `animationOrder`).
 */
export function deckReducer(deck: SlideDeck, action: DeckAction): SlideDeck {
  switch (action.type) {
    case 'slide/add': {
      const slides = [...deck.slides]
      slides.splice(action.index, 0, action.slide)
      return { ...deck, slides }
    }
    case 'slide/duplicate': {
      const index = deck.slides.findIndex((s) => s.id === action.slideId)
      const slide = deck.slides[index]
      if (!slide) return deck
      const elements = withFreshIds(slide.elements)
      // The play order kept, by the copies' new ids.
      const newIds = new Map(
        slide.elements.flatMap((e, i) =>
          (e.animations ?? []).map((a, j): [string, string] => [
            a.id,
            elements[i]?.animations?.[j]?.id ?? a.id,
          ]),
        ),
      )
      const copy: DeckSlide = {
        ...slide,
        id: newDeckId(),
        elements,
        animationOrder: slide.animationOrder?.map((id) => newIds.get(id) ?? id),
      }
      const slides = [...deck.slides]
      slides.splice(index + 1, 0, copy)
      return { ...deck, slides }
    }
    case 'slide/remove':
      return {
        ...deck,
        slides: deck.slides.filter((s) => s.id !== action.slideId),
      }
    case 'slide/move':
      return { ...deck, slides: moveItem(deck.slides, action.from, action.to) }
    case 'slide/update':
      return onSlide(deck, action.slideId, (s) => ({ ...s, ...action.patch }))
    case 'element/insert':
      return onSlide(deck, action.slideId, (s) => ({
        ...s,
        elements: [...s.elements, ...action.elements],
      }))
    case 'element/update':
      return onSlide(deck, action.slideId, (s) =>
        onElements(s, (e) =>
          e.id === action.elementId
            ? ({ ...e, ...action.patch } as DeckElement)
            : e,
        ),
      )
    case 'element/remove':
      return onSlide(deck, action.slideId, (s) => {
        const gone = s.elements.find((e) => e.id === action.elementId)
        const goneIds = new Set(gone?.animations?.map((a) => a.id))
        return {
          ...s,
          elements: s.elements.filter((e) => e.id !== action.elementId),
          animationOrder: s.animationOrder?.filter((id) => !goneIds.has(id)),
        }
      })
    case 'element/order':
      return onSlide(deck, action.slideId, (s) => {
        const from = s.elements.findIndex((e) => e.id === action.elementId)
        const to = action.direction === 'forward' ? from + 1 : from - 1
        if (from < 0 || to < 0 || to >= s.elements.length) return s
        return { ...s, elements: moveItem(s.elements, from, to) }
      })
    case 'animation/add':
      return onSlide(deck, action.slideId, (s) => {
        const order = orderedAnimationIds(s)
        return {
          ...onElements(s, (e) =>
            e.id === action.elementId
              ? {
                  ...e,
                  animations: [...(e.animations ?? []), action.animation],
                }
              : e,
          ),
          animationOrder: [...order, action.animation.id],
        }
      })
    case 'animation/update':
      return onSlide(deck, action.slideId, (s) =>
        onElements(s, (e) =>
          e.animations?.some((a) => a.id === action.animationId)
            ? {
                ...e,
                animations: e.animations.map((a) =>
                  a.id === action.animationId ? { ...a, ...action.patch } : a,
                ),
              }
            : e,
        ),
      )
    case 'animation/remove':
      return onSlide(deck, action.slideId, (s) => ({
        ...onElements(s, (e) =>
          e.animations?.some((a) => a.id === action.animationId)
            ? {
                ...e,
                animations: e.animations.filter(
                  (a) => a.id !== action.animationId,
                ),
              }
            : e,
        ),
        animationOrder: s.animationOrder?.filter(
          (id) => id !== action.animationId,
        ),
      }))
    case 'animation/move':
      return onSlide(deck, action.slideId, (s) => ({
        ...s,
        animationOrder: moveItem(
          orderedAnimationIds(s),
          action.from,
          action.to,
        ),
      }))
  }
}
