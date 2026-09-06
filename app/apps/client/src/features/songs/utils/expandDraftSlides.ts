import {
  type ExpandedSlide,
  expandSongSlidesWithChoruses,
} from './expandSongSlides'
import type { ChordMapping, SlideStyleOverride, SongSlide } from '../types'

/** A slide as the editor holds it: not saved yet, so its id may be a string. */
export interface DraftSlide {
  id: string | number
  content: string
  chords?: ChordMapping[] | null
  sortOrder: number
  label?: string | null
  notes?: string | null
  styleOverrides?: SlideStyleOverride | null
}

/**
 * Chorus-expands the slides the editor currently has in hand, unsaved ones
 * included, so the editor's rail shows the song as it will look once saved
 * rather than as the server last saw it.
 *
 * A slide the server has never seen has no id, so it gets a negative stand-in
 * — unique, and never colliding with a real one, which is all the expansion
 * needs it for.
 */
export function expandDraftSlides(slides: DraftSlide[]): ExpandedSlide[] {
  const asSongSlides: SongSlide[] = slides.map((slide, index) => ({
    id: typeof slide.id === 'number' ? slide.id : -(index + 1),
    songId: 0,
    content: slide.content,
    chords: slide.chords ?? null,
    sortOrder: slide.sortOrder,
    label: slide.label ?? null,
    notes: slide.notes ?? null,
    styleOverrides: slide.styleOverrides ?? null,
    createdAt: 0,
    updatedAt: 0,
  }))

  return expandSongSlidesWithChoruses(asSongSlides)
}
