import type { DeckElement } from '../../types'
import type { PptxShapesRead } from '../slide/types'
import type { PptxImportNote } from '../types'

/**
 * The fallback a file gives for a chart, SmartArt or OLE object it cannot be
 * read as: its pictures marked as standing in for it (`picture_fallback`).
 */
export function asPictureFallback(
  read: PptxShapesRead,
  reason: 'chart' | 'smartart' | 'ole',
  detail: string | undefined,
): PptxShapesRead {
  const elements = read.elements.map(
    (element): DeckElement =>
      element.type === 'image'
        ? {
            id: element.id,
            type: 'picture_fallback',
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
            rotation: element.rotation,
            opacity: element.opacity,
            mediaId: element.mediaId,
            reason,
          }
        : element,
  )
  const note: Omit<PptxImportNote, 'slide'> = {
    outcome: 'picture',
    reason,
    detail,
  }
  return { ...read, elements, notes: [...read.notes, note] }
}
