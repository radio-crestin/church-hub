import type { SongSnapshot } from './types'
import type { SongSlide } from '../songs/types'

/** Keeps only what history remembers: the title and each slide's own content. */
export function buildSongSnapshot(
  title: string,
  slides: SongSlide[],
): SongSnapshot {
  return {
    title,
    slides: slides.map((slide, index) => ({
      content: slide.content,
      sortOrder: index,
      label: slide.label,
      notes: slide.notes,
      chords: slide.chords,
      styleOverrides: slide.styleOverrides,
    })),
  }
}
