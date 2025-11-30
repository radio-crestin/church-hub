/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data?: T
  error?: string
}

/**
 * Operation result
 */
export interface OperationResult {
  success: boolean
  error?: string
  id?: number
}

/**
 * Content types for presentations
 */
export type ContentType = 'song' | 'bible' | 'text'

/**
 * Slide content structure
 */
export interface SlideContent {
  index: number
  content: string
  plainText: string
}

/**
 * Presentation session
 */
export interface PresentationSession {
  id: number
  content_type: ContentType
  content_id: number | null
  content_data: string
  current_slide: number
  is_active: number
  theme_id: number | null
  created_at: number
  updated_at: number
}

/**
 * Queue item with session
 */
export interface QueueItemWithSession {
  id: number
  position: number
  session: {
    id: number
    contentType: ContentType
    title: string
    slides: SlideContent[]
    currentSlide: number
  }
}

/**
 * Queue state
 */
export interface QueueState {
  queue: QueueItemWithSession[]
  activePosition: number
}

/**
 * Presentation theme
 */
export interface PresentationTheme {
  id: number
  name: string
  config: string
  is_default: number
  created_at: number
  updated_at: number
}

/**
 * Theme config
 */
export interface ThemeConfig {
  fontFamily: string
  fontSize: number
  fontColor: string
  backgroundColor: string
  backgroundImage?: string
  textAlign: 'left' | 'center' | 'right'
  padding: number
}

/**
 * Input for adding to queue
 */
export interface AddToQueueInput {
  content_type: ContentType
  content_id?: number
  slides: SlideContent[]
  theme_id?: number
}

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'slide_change'
  | 'queue_update'
  | 'session_update'
  | 'subscribed'
  | 'pong'
  | 'error'

/**
 * Slide change message
 */
export interface SlideChangeMessage {
  type: 'slide_change'
  timestamp: number
  payload: {
    sessionId: number
    slideIndex: number
    content: string
    plainText: string
  }
}

/**
 * Queue update message
 */
export interface QueueUpdateMessage {
  type: 'queue_update'
  timestamp: number
  payload: {
    queue: Array<{
      id: number
      position: number
      session: {
        id: number
        contentType: string
        title: string
        currentSlide: number
        totalSlides: number
      }
    }>
    activePosition: number
  }
}

/**
 * Session update message
 */
export interface SessionUpdateMessage {
  type: 'session_update'
  timestamp: number
  payload: {
    sessionId: number
    currentSlide: number
    isActive: boolean
  }
}

/**
 * WebSocket message union
 */
export type WSMessage =
  | SlideChangeMessage
  | QueueUpdateMessage
  | SessionUpdateMessage
  | {
      type: 'subscribed' | 'pong' | 'error'
      timestamp: number
      payload?: unknown
    }
