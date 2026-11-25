import type { DeckElement, DeckShape, DeckTextStyle } from '../../types'
import { newDeckId } from '../../utils/newDeckId'
import { paragraphHtml } from '../../utils/paragraphHtml'

/** What can be inserted on a slide from the toolbar. */
export type DeckInsert =
  | { type: 'text'; text: string; style: DeckTextStyle }
  | { type: 'image' | 'video'; mediaId: string }
  | { type: 'shape'; shape: DeckShape }

/**
 * A new element centred on a `width`×`height` slide: a text box in the
 * theme's text style, a picture or video (half the slide, kept whole), or a
 * shape.
 */
export function newElement(
  insert: DeckInsert,
  width: number,
  height: number,
): DeckElement {
  const box = (w: number, h: number) => ({
    id: newDeckId(),
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  })
  switch (insert.type) {
    case 'text':
      return {
        ...box(width * 0.5, height * 0.15),
        type: 'text',
        html: paragraphHtml(insert.text, 'left'),
        verticalAlign: 'top',
        fontFamily: insert.style.fontFamily,
        fontSize: Math.round(insert.style.fontSize * 0.55 * (width / 1920)),
        color: insert.style.color,
      }
    case 'image':
      return {
        ...box(width * 0.5, height * 0.5),
        type: 'image',
        mediaId: insert.mediaId,
        fit: 'contain',
      }
    case 'video':
      return {
        ...box(width * 0.5, height * 0.5),
        type: 'video',
        mediaId: insert.mediaId,
        autoplay: true,
      }
    case 'shape': {
      const line = insert.shape === 'line'
      return {
        ...box(width * 0.25, line ? height * 0.01 : height * 0.25),
        type: 'shape',
        shape: insert.shape,
        ...(line ? { stroke: '#ffffff', strokeWidth: 6 } : {}),
      }
    }
  }
}
