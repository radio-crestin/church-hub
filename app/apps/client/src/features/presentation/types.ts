/**
 * Background type options for displays
 */
export type BackgroundType = 'transparent' | 'color' | 'image'

/**
 * Display open mode - browser tab or native Tauri window
 */
export type DisplayOpenMode = 'browser' | 'native'

/**
 * Display theme configuration
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
 * Display entity
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
 * Presentation state
 */
export interface PresentationState {
  currentQueueItemId: number | null
  currentSongSlideId: number | null
  currentBiblePassageVerseId: number | null
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
  lastSongSlideId?: number | null
  isPresenting?: boolean
  isHidden?: boolean
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
