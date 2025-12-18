/**
 * Background type options for displays
 */
export type BackgroundType = 'transparent' | 'color' | 'image'

/**
 * Display open mode - browser tab or native Tauri window
 */
export type DisplayOpenMode = 'browser' | 'native'

/**
 * Display theme JSON structure
 */
export interface DisplayTheme {
  backgroundType: BackgroundType
  backgroundColor?: string
  backgroundImage?: string
  textColor?: string
  fontFamily?: string
  padding?: number
}

/**
 * Display record from database
 */
export interface DisplayRecord {
  id: number
  name: string
  is_active: number
  open_mode: string
  is_fullscreen: number
  theme: string
  created_at: number
  updated_at: number
}

/**
 * Display API response format
 */
export interface Display {
  id: number
  name: string
  isActive: boolean
  openMode: DisplayOpenMode
  isFullscreen: boolean
  theme: DisplayTheme
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating/updating a display
 */
export interface UpsertDisplayInput {
  id?: number
  name: string
  isActive?: boolean
  openMode?: DisplayOpenMode
  isFullscreen?: boolean
  theme?: DisplayTheme
}

/**
 * Display slide config record from database
 */
export interface DisplaySlideConfigRecord {
  id: number
  display_id: number
  slide_id: number
  config: string
  created_at: number
  updated_at: number
}

/**
 * Display slide config API format
 */
export interface DisplaySlideConfig {
  id: number
  displayId: number
  slideId: number
  config: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

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

/**
 * Default display theme
 */
export function getDefaultTheme(): DisplayTheme {
  return {
    backgroundType: 'color',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    fontFamily: 'system-ui',
    padding: 40,
  }
}
