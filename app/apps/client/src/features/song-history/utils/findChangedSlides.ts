import type { SongHistorySlide, SongSnapshot } from '../types'

export interface ChangedSlide {
  /** Zero-based position of the slide. */
  index: number
  before: SongHistorySlide | null
  after: SongHistorySlide | null
}

/** The slides whose content, label or notes differ, compared position by position. */
export function findChangedSlides(
  before: SongSnapshot | null,
  after: SongSnapshot,
): ChangedSlide[] {
  const beforeSlides = before?.slides ?? []
  const total = Math.max(beforeSlides.length, after.slides.length)
  const changed: ChangedSlide[] = []
  for (let index = 0; index < total; index++) {
    const slideBefore = beforeSlides[index] ?? null
    const slideAfter = after.slides[index] ?? null
    if (
      slideBefore?.content !== slideAfter?.content ||
      slideBefore?.label !== slideAfter?.label ||
      slideBefore?.notes !== slideAfter?.notes
    ) {
      changed.push({ index, before: slideBefore, after: slideAfter })
    }
  }
  return changed
}
