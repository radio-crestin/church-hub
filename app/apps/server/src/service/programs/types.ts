/**
 * Slide content type
 */
export type SlideType = 'custom' | 'song' | 'bible'

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right'

/**
 * Vertical alignment options
 */
export type VerticalAlign = 'top' | 'center' | 'bottom'

/**
 * Slide content JSON structure
 */
export interface SlideContent {
  type: SlideType
  html?: string
  textAlign?: TextAlign
  verticalAlign?: VerticalAlign
  autoFitText?: boolean
}

/**
 * Program record from database
 */
export interface ProgramRecord {
  id: number
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

/**
 * Slide record from database
 */
export interface SlideRecord {
  id: number
  program_id: number
  type: string
  content: string
  sort_order: number
  created_at: number
  updated_at: number
}

/**
 * Program API response format
 */
export interface Program {
  id: number
  name: string
  description: string | null
  createdAt: number
  updatedAt: number
}

/**
 * Program with slides API response format
 */
export interface ProgramWithSlides extends Program {
  slides: Slide[]
}

/**
 * Slide API response format
 */
export interface Slide {
  id: number
  programId: number
  type: SlideType
  content: SlideContent
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating/updating a program
 */
export interface UpsertProgramInput {
  id?: number
  name: string
  description?: string | null
}

/**
 * Input for creating/updating a slide
 */
export interface UpsertSlideInput {
  id?: number
  programId: number
  type?: SlideType
  content: SlideContent
  sortOrder?: number
}

/**
 * Input for reordering slides
 */
export interface ReorderSlidesInput {
  slideIds: number[]
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
