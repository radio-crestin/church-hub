import type { DeckAnimation, DeckElement, DeckSlide } from '../types'

/** A change of the deck being edited; each one is a step of undo. */
export type DeckAction =
  | {
      type: 'slide/add'
      slide: DeckSlide
      /** Where it goes in the deck. */
      index: number
    }
  | { type: 'slide/duplicate'; slideId: string }
  | { type: 'slide/remove'; slideId: string }
  | { type: 'slide/move'; from: number; to: number }
  | { type: 'slide/update'; slideId: string; patch: Partial<DeckSlide> }
  | { type: 'element/insert'; slideId: string; elements: DeckElement[] }
  | {
      type: 'element/update'
      slideId: string
      elementId: string
      patch: Partial<DeckElement>
    }
  | { type: 'element/remove'; slideId: string; elementId: string }
  | {
      type: 'element/order'
      slideId: string
      elementId: string
      direction: 'forward' | 'backward'
    }
  | {
      type: 'animation/add'
      slideId: string
      elementId: string
      animation: DeckAnimation
    }
  | {
      type: 'animation/update'
      slideId: string
      animationId: string
      patch: Partial<DeckAnimation>
    }
  | { type: 'animation/remove'; slideId: string; animationId: string }
  | { type: 'animation/move'; slideId: string; from: number; to: number }

/** An element's box while it is dragged, before the drag is a change. */
export interface DeckDraftBox {
  elementId: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

/** A snap line shown while dragging, in design pixels. */
export interface DeckGuide {
  axis: 'x' | 'y'
  at: number
}
