/**
 * Display open mode - browser tab or native Tauri window
 */
export type DisplayOpenMode = 'browser' | 'native'

/**
 * Presentation state
 */
export interface PresentationState {
  currentQueueItemId: number | null
  currentSongSlideId: number | null
  currentBiblePassageVerseId: number | null
  currentVerseteTineriEntryId: number | null
  lastSongSlideId: number | null
  isPresenting: boolean
  isHidden: boolean
  updatedAt: number
}

/**
 * Input for updating presentation state
 */
export interface UpdatePresentationStateInput {
  currentQueueItemId?: number | null
  currentSongSlideId?: number | null
  currentBiblePassageVerseId?: number | null
  currentVerseteTineriEntryId?: number | null
  lastSongSlideId?: number | null
  isPresenting?: boolean
  isHidden?: boolean
}

// ============================================================================
// SCREEN TYPES
// ============================================================================

/**
 * Screen types
 */
export type ScreenType = 'primary' | 'stage' | 'livestream'

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
  alignment: 'left' | 'center' | 'right'
  verticalAlignment: 'top' | 'middle' | 'bottom'
  lineHeight: number
  shadow?: boolean
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
  visibleWhenHidden?: boolean
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
  visibleWhenHidden?: boolean
}

/**
 * Reference text element configuration (for bible verses)
 */
export interface ReferenceTextConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding?: number
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  visibleWhenHidden?: boolean
}

/**
 * Person label element configuration (for versete tineri)
 */
export interface PersonLabelConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding?: number
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
  visibleWhenHidden?: boolean
}

/**
 * Content type configuration - different for each content type
 */
export interface SongContentConfig {
  background: ScreenBackgroundConfig
  mainText: TextElementConfig
  clock?: ClockElementConfig
}

export interface BibleContentConfig {
  background: ScreenBackgroundConfig
  referenceText: ReferenceTextConfig
  contentText: TextElementConfig
  clock?: ClockElementConfig
}

export interface AnnouncementContentConfig {
  background: ScreenBackgroundConfig
  mainText: TextElementConfig
  clock?: ClockElementConfig
}

export interface VerseteTineriContentConfig {
  background: ScreenBackgroundConfig
  personLabel: PersonLabelConfig
  referenceText: ReferenceTextConfig
  contentText: TextElementConfig
  clock?: ClockElementConfig
}

export interface EmptyContentConfig {
  background: ScreenBackgroundConfig
  clock: ClockElementConfig
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
  visibleWhenHidden?: boolean
}

/**
 * Screen global settings
 */
export interface ScreenGlobalSettings {
  defaultBackground: ScreenBackgroundConfig
  clockEnabled: boolean
  clockConfig?: ClockElementConfig
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
