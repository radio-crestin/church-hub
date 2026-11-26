import { type RefObject, useCallback, useState } from 'react'

import type { DeckElement, DeckSlide } from '../../types'
import type { DeckAction, DeckDraftBox, DeckGuide } from '../types'
import { type DeckResizeHandle, resizeBox } from '../utils/resizeBox'
import { rotationAt } from '../utils/rotationAt'
import { snapBox } from '../utils/snapBox'

/** Guides catch a box this close, in screen pixels. */
const SNAP_PX = 8

type Gesture =
  | { kind: 'move' }
  | { kind: 'resize'; handle: DeckResizeHandle }
  | { kind: 'rotate' }

interface UseElementGesturesInput {
  slide: DeckSlide
  /** The deck's design size. */
  width: number
  height: number
  /** Screen pixels per design pixel. */
  scale: number
  canvasRef: RefObject<HTMLDivElement | null>
  change: (action: DeckAction) => void
}

function boxOf(element: DeckElement): DeckDraftBox {
  return {
    elementId: element.id,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    rotation: element.rotation ?? 0,
  }
}

/**
 * Moving, resizing (8 handles, Shift keeps the shape) and rotating (Shift in
 * 15° steps) an element with the mouse, a pen or a finger. While it is
 * dragged only a draft box changes, pulled onto guides (Alt turns them off);
 * letting go makes it one change of the deck.
 */
export function useElementGestures({
  slide,
  width,
  height,
  scale,
  canvasRef,
  change,
}: UseElementGesturesInput) {
  const [draft, setDraft] = useState<DeckDraftBox | null>(null)
  const [guides, setGuides] = useState<DeckGuide[]>([])

  const start = useCallback(
    (event: React.PointerEvent, element: DeckElement, gesture: Gesture) => {
      const canvas = canvasRef.current
      if (!canvas || element.locked) return
      event.preventDefault()
      event.stopPropagation()
      const rect = canvas.getBoundingClientRect()
      const toDesign = (e: PointerEvent | React.PointerEvent) => ({
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      })
      const from = toDesign(event)
      const startBox = boxOf(element)
      const others = slide.elements
        .filter((e) => e.id !== element.id)
        .map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }))
      let current = startBox

      const onMove = (e: PointerEvent) => {
        const at = toDesign(e)
        const dx = at.x - from.x
        const dy = at.y - from.y
        let next = startBox
        let lines: DeckGuide[] = []
        if (gesture.kind === 'move') {
          const moved = { ...startBox, x: startBox.x + dx, y: startBox.y + dy }
          if (e.altKey) {
            next = moved
          } else {
            const snapped = snapBox(
              moved,
              others,
              { width, height },
              SNAP_PX / scale,
            )
            next = { ...moved, ...snapped.box }
            lines = snapped.guides
          }
        } else if (gesture.kind === 'resize') {
          // The drag along the box's own (rotated) axes.
          const turn = (-startBox.rotation * Math.PI) / 180
          const localX = dx * Math.cos(turn) - dy * Math.sin(turn)
          const localY = dx * Math.sin(turn) + dy * Math.cos(turn)
          next = {
            ...startBox,
            ...resizeBox(startBox, gesture.handle, localX, localY, e.shiftKey),
          }
        } else {
          const center = {
            x: startBox.x + startBox.w / 2,
            y: startBox.y + startBox.h / 2,
          }
          next = { ...startBox, rotation: rotationAt(center, at, e.shiftKey) }
        }
        current = next
        setDraft(next)
        setGuides(lines)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        setDraft(null)
        setGuides([])
        if (current === startBox) return
        change({
          type: 'element/update',
          slideId: slide.id,
          elementId: element.id,
          patch: {
            x: Math.round(current.x),
            y: Math.round(current.y),
            w: Math.round(current.w),
            h: Math.round(current.h),
            rotation: current.rotation || undefined,
          },
        })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [canvasRef, change, height, scale, slide, width],
  )

  return { draft, guides, start }
}
