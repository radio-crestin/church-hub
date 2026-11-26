import type { DeckShownSlide } from '~/features/slides-deck/types'
import type { SlideStyleOverride } from '~/features/songs/types'
import type {
  ContentType,
  PresentationBackground,
  ScreenBackgroundConfig,
} from '../../types'

export interface ChordMapping {
  wordIndex: number
  chord: string
}

export interface ContentData {
  mainText?: string
  referenceText?: string
  contentText?: string
  personLabel?: string
  chords?: ChordMapping[] | null
  songKey?: string // Song key ("gama"), populated only on the first slide
  amen?: string // "Amin", populated only on the last slide
  songTitle?: string // The song's title, on every slide of a song
  songTitleNumber?: string // Its songbook and number ("PDC 19"), if it has one
  /** Per-slide text styling merged over the screen's own style. */
  styleOverrides?: SlideStyleOverride | null
  /** The song's own background (see `resolveScreenBackground`). */
  songBackground?: ScreenBackgroundConfig | null
  /** A presentation's video item, shown full screen (ScreenVideo). */
  videoUrl?: string
  /** The video item plays again from the start until the step changes. */
  videoLoop?: boolean
  /** A presentation's looping background video (see `resolveScreenBackground`). */
  presentationBackground?: PresentationBackground | null
  /** A Slides item's slide (DeckSlideRenderer). */
  deck?: DeckShownSlide
}

export interface VerseteTineriSummaryEntry {
  personName: string
  reference: string
}

export interface NextSlideData {
  contentType: ContentType
  preview: string
  /** Type-specific label (e.g., "Cântare:", "Versete Tineri:", "Anunț:", "Pasaj Biblic:") */
  label?: string
  /** Title for content that has one (e.g., song title) */
  title?: string
  verseteTineriSummary?: {
    entries: VerseteTineriSummaryEntry[]
    hasMore: boolean
  }
}
