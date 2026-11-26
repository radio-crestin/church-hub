import type { SlideDeck } from '~/features/slides-deck/types'
import type {
  ItemConfig,
  MediaItemType,
  ScheduleMusicSummary,
  ScheduleVideoPick,
} from './media-items/types'
import type { VerseSegment } from '../bible/utils/parseVerseList'
import type { SongSlide } from '../songs/types'

/**
 * Schedule item types (same as queue)
 */
export type ScheduleItemType =
  | 'song'
  | 'slide'
  | 'bible_passage'
  | 'music'
  | 'video'
  | 'verses'
  /** A deck of our own slides (features/slides-deck), its `itemConfig`. */
  | 'slides'

/**
 * Slide template types for standalone slides (same as queue)
 */
export type SlideTemplate = 'announcement' | 'versete_tineri' | 'scene'

/**
 * Bible passage verse (nested within bible_passage schedule items)
 */
export interface ScheduleBiblePassageVerse {
  id: number
  verseId: number
  reference: string
  text: string
  sortOrder: number
}

/**
 * Versete Tineri entry (nested within versete_tineri slides)
 */
export interface ScheduleVerseteTineriEntry {
  id: number
  personName: string
  translationId: number
  bookCode: string
  bookName: string
  reference: string
  text: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  sortOrder: number
}

/** What happens in OBS that can start or stop a presentation. */
export type AutomationTriggerEvent =
  | 'scene_selected'
  | 'stream_started'
  | 'stream_stopped'
  | 'recording_started'
  | 'recording_stopped'

/** A presentation's start or stop trigger. */
export interface AutomationTrigger {
  event: AutomationTriggerEvent
  /** The scene that fires it (`scene_selected` only); null otherwise. */
  sceneName: string | null
}

/**
 * How a presentation runs by itself: the server moves it on, each step after
 * its own time (see `utils/stepSeconds` and the server's
 * service/schedule-automation).
 */
export interface ScheduleAutomationSettings {
  /**
   * Seconds each slide stays up while it runs; null = manual. An item's own
   * `advanceSeconds` wins over it.
   */
  autoplaySeconds: number | null
  /** A slide with more text stays up longer, so it can be read. */
  autoplayByText: boolean
  /** Past the last step, start again from the first. */
  loop: boolean
  /** Music player volume (0-100) set when it starts; null = unchanged. */
  musicVolume: number | null
  /** Started by itself when Church Hub starts (one presentation at most). */
  startOnAppStart: boolean
  /** Started by itself when this happens in OBS; null = never. */
  startTrigger: AutomationTrigger | null
  /** Stopped (and taken off the screens) when this happens; null = never. */
  stopTrigger: AutomationTrigger | null
}

/** What the presentation runner on the server is doing. */
export type ScheduleAutomationState =
  | { running: false }
  | {
      running: true
      scheduleId: number
      title: string
      /** Position of the step on screen in the running order. */
      stepIndex: number
      stepCount: number
      /** How long the step on screen stays up. */
      stepSeconds: number
      loop: boolean
      /** When the next step goes up (epoch ms). */
      nextStepAt: number
    }

/**
 * Schedule list item
 */
export interface Schedule {
  id: number
  title: string
  description: string | null
  automation: ScheduleAutomationSettings
  /** The slide template for all its slides; null = each screen's own. */
  templateId: number | null
  itemCount: number
  songCount: number
  createdAt: number
  updatedAt: number
}

/**
 * Schedule item
 */
export interface ScheduleItem {
  id: number
  scheduleId: number
  itemType: ScheduleItemType
  songId: number | null
  song: {
    id: number
    title: string
    categoryName: string | null
    tagNames: string[]
  } | null
  slides: SongSlide[]
  /** Song key line ("gama"), joined from the song. */
  keyLine: string | null
  /** Manual "already sung" marker scoped to this schedule (song items only). */
  isSung: boolean
  /** Unix timestamp in ms when marked sung, null otherwise. */
  sungAt: number | null
  slideType: SlideTemplate | null
  slideContent: string | null
  // Bible passage fields (present when itemType === 'bible_passage')
  biblePassageReference: string | null
  biblePassageTranslation: string | null
  biblePassageVerses: ScheduleBiblePassageVerse[]
  // Versete Tineri fields (present when itemType === 'slide' && slideType === 'versete_tineri')
  verseteTineriEntries: ScheduleVerseteTineriEntry[]
  // Scene fields (present when itemType === 'slide' && slideType === 'scene')
  obsSceneName: string | null
  /** Seconds each slide of this item stays up when it runs by itself; null = the presentation's. */
  advanceSeconds: number | null
  /** This item's own slide template; null = the presentation's. */
  templateId: number | null
  /**
   * A music, video or verses item's settings, or how many of a Versete
   * Biblice slide's passages it shows; null for the others. A verses item's
   * passages of this run are in `verseteTineriEntries`.
   */
  itemConfig: ItemConfig | null
  /**
   * Every passage of a Versete Biblice slide that shows only some of them at
   * random (its `itemConfig.count`), for its editor; null otherwise.
   */
  allVerseteTineriEntries: ScheduleVerseteTineriEntry[] | null
  /** A music item's tracks. */
  music: ScheduleMusicSummary | null
  /** The video a video item shows this run; null when the gallery has none. */
  video: ScheduleVideoPick | null
  /** A MIDI file played when the running presentation reaches this song item. */
  midi: ScheduleItemMidi | null
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/**
 * A song item's MIDI file: played when the running presentation reaches the
 * item, each slide going up at its time in the music.
 */
export interface ScheduleItemMidi {
  hash: string
  fileName: string
  durationSeconds: number
  /** The second each slide (choruses expanded) starts at; null = split evenly. */
  verseTimes: number[] | null
}

/**
 * Schedule with items
 */
export interface ScheduleWithItems extends Schedule {
  items: ScheduleItem[]
}

/**
 * Input for creating/updating a schedule
 */
export interface UpsertScheduleInput {
  id?: number
  title: string
  description?: string | null
  /** Only the settings given change; the others keep their value. */
  automation?: Partial<ScheduleAutomationSettings>
}

/**
 * Single entry for Versete Tineri input
 */
export interface VerseteTineriEntryInput {
  /**
   * Optional: a passage added straight from the Bible has nobody attached to
   * it. Stored as '' when absent.
   */
  personName?: string
  translationId: number
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  /** Runs of a comma verse list with a gap ("Ioan 3:16-18,20"). */
  verseSegments?: VerseSegment[]
}

/**
 * A Bible passage as the server takes it when adding or updating an item
 */
export interface BiblePassageInput {
  translationId: number
  translationAbbreviation: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  verseSegments?: VerseSegment[]
}

/**
 * Input for adding an item to a schedule
 */
export interface AddToScheduleInput {
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
  afterItemId?: number
  // Bible passage fields
  biblePassage?: BiblePassageInput
  // Versete Tineri entries
  verseteTineriEntries?: VerseteTineriEntryInput[]
  // Scene fields
  obsSceneName?: string
  /** A music, video or verses item and its settings. */
  media?: { itemType: MediaItemType; itemConfig: ItemConfig }
  /** A Slides item: its deck. */
  slides?: SlideDeck
}

/**
 * Input for updating a slide in a schedule
 */
export interface UpdateScheduleSlideInput {
  slideType?: SlideTemplate
  slideContent?: string
  // Versete Tineri entries (for versete_tineri slides)
  verseteTineriEntries?: VerseteTineriEntryInput[]
  biblePassage?: BiblePassageInput
}

/**
 * Input for reordering schedule items
 */
export interface ReorderScheduleItemsInput {
  itemIds: number[]
}

/**
 * Schedule search result
 */
export interface ScheduleSearchResult {
  id: number
  title: string
  description: string | null
  itemCount: number
  matchedContent: string
}

/**
 * Input for replacing all items in a schedule
 */
export interface LegacyBiblePassageInput {
  /** Display reference, e.g. "Ioan 3:16 - RCCV". */
  reference: string | null
  translationAbbreviation: string | null
  verses: Array<{
    verseId: number
    reference: string
    text: string
    sortOrder: number
  }>
}

export interface ReplaceScheduleItemsInput {
  items: Array<{
    type: 'song' | 'slide'
    songId?: number
    slideType?: SlideTemplate
    slideContent?: string
    // Bible passage fields
    biblePassage?: {
      translationId: number
      translationAbbreviation: string
      bookCode: string
      bookName: string
      startChapter: number
      startVerse: number
      endChapter: number
      endVerse: number
    }
    // Versete Tineri entries
    verseteTineriEntries?: VerseteTineriEntryInput[]
    /**
     * A legacy `bible_passage` item read back from an exported program file.
     * The server resolves it against the Bible and stores it as one
     * "Versete Biblice" slide.
     */
    legacyBiblePassage?: LegacyBiblePassageInput
    // Scene fields
    obsSceneName?: string
  }>
}

/**
 * Missing song item (for text editing flow)
 */
export interface MissingSongItem {
  title: string
  lineNumber: number
  resolved?: { type: 'existing'; songId: number } | { type: 'create' }
}

/**
 * Skipped item info returned when verses are not found
 */
export interface SkippedItem {
  index: number
  type: 'bible_passage' | 'versete_tineri_entry'
  reference: string
  reason: string
}
