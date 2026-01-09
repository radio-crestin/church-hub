/**
 * Display open mode - browser tab or native Tauri window
 */
export type DisplayOpenMode = 'browser' | 'native'

/**
 * Presentation state
 */
export interface PresentationState {
  currentSongSlideId: number | null
  lastSongSlideId: number | null
  isPresenting: boolean
  isHidden: boolean
  temporaryContent: TemporaryContent | null
  slideHighlights: TextStyleRange[]
  updatedAt: number
}

/**
 * Input for updating presentation state
 */
export interface UpdatePresentationStateInput {
  currentSongSlideId?: number | null
  lastSongSlideId?: number | null
  isPresenting?: boolean
  isHidden?: boolean
  temporaryContent?: TemporaryContent | null
  slideHighlights?: TextStyleRange[] | null
}

// ============================================================================
// SLIDE HIGHLIGHT TYPES (for live text styling)
// ============================================================================

/**
 * Text style range for inline highlighting
 */
export interface TextStyleRange {
  id: string // UUID for removal
  start: number // Character offset start
  end: number // Character offset end
  highlight?: string // Hex color (e.g., '#FFFF00')
  bold?: boolean
  underline?: boolean
}

/**
 * Input for adding a new highlight (without ID - generated client-side)
 */
export interface AddHighlightInput {
  start: number
  end: number
  highlight?: string
  bold?: boolean
  underline?: boolean
}

// ============================================================================
// TEMPORARY CONTENT TYPES (for instant display)
// ============================================================================

/**
 * Temporary Bible content for instant display
 */
export interface TemporaryBibleContent {
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  // Navigation context
  translationId: number
  bookId: number
  bookCode: string
  chapter: number
  currentVerseIndex: number // 0-based index in chapter
  // Secondary version (optional)
  secondaryText?: string
  secondaryBookName?: string
  secondaryTranslationAbbreviation?: string
}

/**
 * Temporary slide for song display
 */
export interface TemporarySongSlide {
  id: number
  content: string
  sortOrder: number
}

/**
 * Preview of next item in a schedule (used for next slide section)
 */
export interface NextItemPreview {
  contentType: ContentType
  preview: string
  /** Type-specific label (e.g., "Cântare:", "Versete Tineri:", "Anunț:", "Pasaj Biblic:") */
  label?: string
  /** Title for content that has one (e.g., song title) */
  title?: string
}

/**
 * Temporary song content for instant display
 */
export interface TemporarySongContent {
  songId: number
  title: string
  slides: TemporarySongSlide[]
  currentSlideIndex: number // 0-based index
  nextItemPreview?: NextItemPreview // Preview of next schedule item (when at last slide)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Temporary announcement content for instant display
 */
export interface TemporaryAnnouncementContent {
  content: string // HTML content
  nextItemPreview?: NextItemPreview // Preview of next schedule item
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Verse entry for Bible passage
 */
export interface BiblePassageVerse {
  verseId: number
  verse: number
  text: string
}

/**
 * Temporary Bible passage content for instant display
 */
export interface TemporaryBiblePassageContent {
  translationId: number
  translationAbbreviation: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  verses: BiblePassageVerse[]
  currentVerseIndex: number // 0-based index in verses array
  // Secondary version (optional)
  secondaryTranslationId?: number
  secondaryTranslationAbbreviation?: string
  secondaryBookName?: string
  secondaryVerses?: BiblePassageVerse[]
  nextItemPreview?: NextItemPreview // Preview of next schedule item (when at last verse)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Versete tineri entry
 */
export interface VerseteTineriEntry {
  id: number
  personName: string
  reference: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  text: string
  sortOrder: number
}

/**
 * Temporary versete tineri content for instant display
 */
export interface TemporaryVerseteTineriContent {
  entries: VerseteTineriEntry[]
  currentEntryIndex: number // 0-based index in entries array
  nextItemPreview?: NextItemPreview // Preview of next schedule item (when at last entry)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Temporary scene content for instant display (shows empty slide)
 */
export interface TemporarySceneContent {
  obsSceneName: string
  nextItemPreview?: NextItemPreview // Preview of next schedule item
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Union type for temporary content
 */
export type TemporaryContent =
  | { type: 'bible'; data: TemporaryBibleContent }
  | { type: 'song'; data: TemporarySongContent }
  | { type: 'announcement'; data: TemporaryAnnouncementContent }
  | { type: 'bible_passage'; data: TemporaryBiblePassageContent }
  | { type: 'versete_tineri'; data: TemporaryVerseteTineriContent }
  | { type: 'scene'; data: TemporarySceneContent }

/**
 * Input for presenting a temporary Bible verse
 */
export interface PresentTemporaryBibleInput {
  verseId: number
  reference: string
  text: string
  translationAbbreviation: string
  bookName: string
  translationId: number
  bookId: number
  bookCode: string
  chapter: number
  currentVerseIndex: number
  // Secondary version (optional)
  secondaryText?: string
  secondaryBookName?: string
  secondaryTranslationAbbreviation?: string
}

/**
 * Input for presenting a temporary song
 */
export interface PresentTemporarySongInput {
  songId: number
  slideIndex?: number // Optional: start from specific slide (0-based)
  nextItemPreview?: NextItemPreview // Preview of next schedule item (for schedule presentations)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Input for navigating within temporary content
 */
export interface NavigateTemporaryInput {
  direction: 'next' | 'prev'
}

/**
 * Input for presenting an announcement
 */
export interface PresentTemporaryAnnouncementInput {
  content: string // HTML content
  nextItemPreview?: NextItemPreview // Preview of next schedule item (for schedule presentations)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Input for presenting a Bible passage
 */
export interface PresentTemporaryBiblePassageInput {
  translationId: number
  translationAbbreviation: string
  bookCode: string
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  verses: BiblePassageVerse[]
  currentVerseIndex?: number // Optional: start from specific verse (0-based)
  // Secondary version (optional)
  secondaryTranslationId?: number
  secondaryTranslationAbbreviation?: string
  secondaryBookName?: string
  secondaryVerses?: BiblePassageVerse[]
  nextItemPreview?: NextItemPreview // Preview of next schedule item (for schedule presentations)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Input for presenting versete tineri
 */
export interface PresentTemporaryVerseteTineriInput {
  entries: VerseteTineriEntry[]
  currentEntryIndex?: number // Optional: start from specific entry (0-based)
  nextItemPreview?: NextItemPreview // Preview of next schedule item (for schedule presentations)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

/**
 * Input for presenting a scene (shows empty slide)
 */
export interface PresentTemporarySceneInput {
  obsSceneName: string
  nextItemPreview?: NextItemPreview // Preview of next schedule item (for schedule presentations)
  // Schedule context (for deep-linking back to schedule)
  scheduleId?: number
  scheduleItemIndex?: number // Index in flatItems for navigation
}

// ============================================================================
// SCREEN TYPES
// ============================================================================

/**
 * Screen types
 */
export type ScreenType = 'primary' | 'stage' | 'livestream' | 'kiosk'

/**
 * Content types that can be rendered on screens
 */
export type ContentType =
  | 'song'
  | 'bible'
  | 'bible_passage'
  | 'announcement'
  | 'versete_tineri'
  | 'empty'

/**
 * Position unit - pixels or percentage
 */
export type PositionUnit = 'px' | '%'

/**
 * Position definition
 */
export interface Position {
  x: number
  y: number
  unit: PositionUnit
}

/**
 * Size definition
 */
export interface Size {
  width: number
  height: number
  unit: PositionUnit
}

/**
 * Single constraint for one edge (top, bottom, left, right)
 */
export interface Constraint {
  enabled: boolean
  value: number
  unit: PositionUnit
}

/**
 * Constraints for all four edges
 */
export interface Constraints {
  top: Constraint
  bottom: Constraint
  left: Constraint
  right: Constraint
}

/**
 * Size with independent units for width and height
 */
export interface SizeWithUnits {
  width: number
  widthUnit: PositionUnit
  height: number
  heightUnit: PositionUnit
}

/**
 * Line separator type for compressed lines
 */
export type LineSeparatorType = 'space' | 'dash' | 'pipe'

/**
 * Text styling configuration
 */
export interface TextStyle {
  fontFamily: string
  maxFontSize: number
  minFontSize?: number
  autoScale: boolean
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  alignment: 'left' | 'center' | 'right' | 'justify'
  verticalAlignment: 'top' | 'middle' | 'bottom'
  lineHeight: number
  shadow?: boolean
  compressLines?: boolean
  lineSeparator?: LineSeparatorType
  fitLineToWidth?: boolean
}

/**
 * Animation types
 */
export type AnimationType =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom'
  | 'blur'

/**
 * Easing types
 */
export type EasingType =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'

/**
 * Animation configuration
 */
export interface AnimationConfig {
  type: AnimationType
  duration: number // milliseconds
  delay: number // milliseconds
  easing: EasingType
}

/**
 * Extended background type (adds video support)
 */
export type ScreenBackgroundType = 'transparent' | 'color' | 'image' | 'video'

/**
 * Background configuration for screens
 */
export interface ScreenBackgroundConfig {
  type: ScreenBackgroundType
  color?: string
  imageUrl?: string
  videoUrl?: string
  opacity: number
}

/**
 * Text element configuration
 */
export interface TextElementConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding: number
  animationIn: AnimationConfig
  animationOut: AnimationConfig
  slideTransitionIn?: AnimationConfig // Animation for new content entering during slide change
  slideTransitionOut?: AnimationConfig // Animation for old content leaving during slide change
  hidden?: boolean
}

/**
 * Clock element configuration
 */
export interface ClockElementConfig {
  enabled: boolean
  constraints: Constraints
  size?: SizeWithUnits
  style: TextStyle
  format: '12h' | '24h'
  showSeconds: boolean
  hidden?: boolean
}

/**
 * Reference text element configuration (for bible verses)
 */
export interface ReferenceTextConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding?: number
  animationIn: AnimationConfig
  animationOut: AnimationConfig
  slideTransitionIn?: AnimationConfig // Animation for new content entering during slide change
  slideTransitionOut?: AnimationConfig // Animation for old content leaving during slide change
  hidden?: boolean
}

/**
 * Person label element configuration (for versete tineri)
 */
export interface PersonLabelConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding?: number
  animationIn: AnimationConfig
  animationOut: AnimationConfig
  slideTransitionIn?: AnimationConfig // Animation for new content entering during slide change
  slideTransitionOut?: AnimationConfig // Animation for old content leaving during slide change
  hidden?: boolean
}

/**
 * Content type configuration - different for each content type
 * Clock is enabled per-content-type but uses shared global config for position/style
 */
export interface SongContentConfig {
  background: ScreenBackgroundConfig
  mainText: TextElementConfig
  clockEnabled?: boolean // Per-slide-type enable, uses global clockConfig for position/style
}

export type ReferenceWrapperStyle = 'none' | 'parentheses' | 'brackets'

export interface BibleContentConfig {
  background: ScreenBackgroundConfig
  referenceText: ReferenceTextConfig
  contentText: TextElementConfig
  clockEnabled?: boolean // Per-slide-type enable, uses global clockConfig for position/style
  includeReferenceInContent?: boolean
  referenceWrapperStyle?: ReferenceWrapperStyle
}

export interface AnnouncementContentConfig {
  background: ScreenBackgroundConfig
  mainText: TextElementConfig
  clockEnabled?: boolean // Per-slide-type enable, uses global clockConfig for position/style
}

export interface VerseteTineriContentConfig {
  background: ScreenBackgroundConfig
  personLabel: PersonLabelConfig
  referenceText: ReferenceTextConfig
  contentText: TextElementConfig
  clockEnabled?: boolean // Per-slide-type enable, uses global clockConfig for position/style
}

export interface EmptyContentConfig {
  background: ScreenBackgroundConfig
  clockEnabled?: boolean // Per-slide-type enable, uses global clockConfig for position/style
}

/**
 * Union type for all content configs
 */
export type ContentTypeConfig =
  | SongContentConfig
  | BibleContentConfig
  | AnnouncementContentConfig
  | VerseteTineriContentConfig
  | EmptyContentConfig

/**
 * Map content type to its config type
 */
export interface ContentConfigMap {
  song: SongContentConfig
  bible: BibleContentConfig
  bible_passage: BibleContentConfig
  announcement: AnnouncementContentConfig
  versete_tineri: VerseteTineriContentConfig
  empty: EmptyContentConfig
}

/**
 * Next slide section configuration (for stage screens)
 */
export interface NextSlideSectionConfig {
  enabled: boolean
  constraints: Constraints
  size: SizeWithUnits
  labelText: string // "Urmeaza:" or similar
  labelStyle: TextStyle
  contentStyle: TextStyle
  background: ScreenBackgroundConfig
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  hidden?: boolean
}

/**
 * Screen global settings
 */
export interface ScreenGlobalSettings {
  defaultBackground: ScreenBackgroundConfig
  clockConfig?: ClockElementConfig // Shared clock config (position, style, format) - enable is per-content-type
}

/**
 * Type alias for global settings (for component compatibility)
 */
export type GlobalSettings = ScreenGlobalSettings

/**
 * Screen entity
 */
export interface Screen {
  id: number
  name: string
  type: ScreenType
  isActive: boolean
  openMode: DisplayOpenMode
  isFullscreen: boolean
  alwaysOnTop: boolean
  width: number
  height: number
  globalSettings: ScreenGlobalSettings
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/**
 * Screen content config entity (stored in DB)
 */
export interface ScreenContentConfigEntity {
  id: number
  screenId: number
  contentType: ContentType
  config: ContentTypeConfig
  createdAt: number
  updatedAt: number
}

/**
 * Screen with all configurations loaded
 */
export interface ScreenWithConfigs extends Screen {
  contentConfigs: {
    [K in ContentType]: ContentConfigMap[K]
  }
  nextSlideConfig?: NextSlideSectionConfig
}

/**
 * Input for creating/updating a screen
 */
export interface UpsertScreenInput {
  id?: number
  name: string
  type: ScreenType
  isActive?: boolean
  openMode?: DisplayOpenMode
  isFullscreen?: boolean
  alwaysOnTop?: boolean
  width?: number
  height?: number
  globalSettings?: ScreenGlobalSettings
  sortOrder?: number
}

/**
 * Input for updating a content config
 */
export interface UpdateContentConfigInput {
  screenId: number
  contentType: ContentType
  config: ContentTypeConfig
}

// ============================================================================
// TYPE ALIASES (for backwards compatibility and convenience)
// ============================================================================

/**
 * Alias for ClockElementConfig
 */
export type ClockConfig = ClockElementConfig

/**
 * Alias for ScreenBackgroundConfig
 */
export type BackgroundConfig = ScreenBackgroundConfig

/**
 * Alias for ContentConfigMap
 */
export type ContentConfigs = ContentConfigMap
