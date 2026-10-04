import type { SongHistoryChanges, SongSnapshot } from './types'

/** Counts what differs between two snapshots, slide by slide in order. */
export function summarizeChanges(
  before: SongSnapshot | null,
  after: SongSnapshot,
): SongHistoryChanges {
  const beforeSlides = before?.slides ?? []
  const shared = Math.min(beforeSlides.length, after.slides.length)
  let slidesChanged = 0
  for (let i = 0; i < shared; i++) {
    if (JSON.stringify(beforeSlides[i]) !== JSON.stringify(after.slides[i])) {
      slidesChanged++
    }
  }
  return {
    titleChanged: before !== null && before.title !== after.title,
    slidesAdded: Math.max(0, after.slides.length - beforeSlides.length),
    slidesRemoved: Math.max(0, beforeSlides.length - after.slides.length),
    slidesChanged,
  }
}
