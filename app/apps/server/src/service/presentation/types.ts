/**
 * Display open mode - browser tab or native Tauri window
 */
export type DisplayOpenMode = 'browser' | 'native'

/**
 * Presentation state record from database
 */
export interface PresentationStateRecord {
  id: number
  current_queue_item_id: number | null
  current_song_slide_id: number | null
  last_song_slide_id: number | null
  current_bible_passage_verse_id: number | null
  current_versete_tineri_entry_id: number | null
  is_presenting: number
  is_hidden: number
  updated_at: number
}

/**
 * Presentation state API format
 */
export interface PresentationState {
  currentQueueItemId: number | null
  currentSongSlideId: number | null
  lastSongSlideId: number | null
  currentBiblePassageVerseId: number | null
  currentVerseteTineriEntryId: number | null
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
  lastSongSlideId?: number | null
  currentBiblePassageVerseId?: number | null
  currentVerseteTineriEntryId?: number | null
  isPresenting?: boolean
  isHidden?: boolean
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}

// ============================================================================
// NEW SCREEN TYPES (replaces Display system)
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
 * Screen record from database
 */
export interface ScreenRecord {
  id: number
  name: string
  type: string
  is_active: number
  open_mode: string
  is_fullscreen: number
  width: number
  height: number
  global_settings: string
  sort_order: number
  created_at: number
  updated_at: number
}

/**
 * Screen content config record from database
 */
export interface ScreenContentConfigRecord {
  id: number
  screen_id: number
  content_type: string
  config: string
  created_at: number
  updated_at: number
}

/**
 * Screen next slide config record from database
 */
export interface ScreenNextSlideConfigRecord {
  id: number
  screen_id: number
  config: string
  created_at: number
  updated_at: number
}

/**
 * Screen API response format
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
 * Screen global settings (stored as JSON)
 */
export interface ScreenGlobalSettings {
  defaultBackground: ScreenBackgroundConfig
  clockEnabled: boolean
  clockConfig?: ClockElementConfig
}

/**
 * Screen background config
 */
export interface ScreenBackgroundConfig {
  type: 'transparent' | 'color' | 'image' | 'video'
  color?: string
  imageUrl?: string
  videoUrl?: string
  opacity: number
}

/**
 * Clock element config
 */
export interface ClockElementConfig {
  enabled: boolean
  constraints: Constraints
  size?: SizeWithUnits
  style: TextStyle
  format: '12h' | '24h'
  showSeconds: boolean
}

/**
 * Position unit - pixels or percentage
 */
export type PositionUnit = 'px' | '%'

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
 * Text style type
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
 * Animation config
 */
export interface AnimationConfig {
  type: string
  duration: number
  delay: number
  easing: string
}

/**
 * Text element config
 */
export interface TextElementConfig {
  constraints: Constraints
  size: SizeWithUnits
  style: TextStyle
  padding: number
  animationIn: AnimationConfig
  animationOut: AnimationConfig
}

/**
 * Screen content config API format (generic for all content types)
 */
export interface ScreenContentConfig {
  id: number
  screenId: number
  contentType: ContentType
  config: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

/**
 * Screen with all configurations loaded
 */
export interface ScreenWithConfigs extends Screen {
  contentConfigs: Record<ContentType, Record<string, unknown>>
  nextSlideConfig?: NextSlideSectionConfig
}

/**
 * Next slide section config (for stage screens)
 */
export interface NextSlideSectionConfig {
  enabled: boolean
  constraints: Constraints
  size: SizeWithUnits
  labelText: string
  labelStyle: TextStyle
  contentStyle: TextStyle
  background: ScreenBackgroundConfig
  animationIn?: AnimationConfig
  animationOut?: AnimationConfig
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
 * Input for updating content config
 */
export interface UpdateContentConfigInput {
  screenId: number
  contentType: ContentType
  config: Record<string, unknown>
}

/**
 * Input for updating next slide config
 */
export interface UpdateNextSlideConfigInput {
  screenId: number
  config: NextSlideSectionConfig
}
