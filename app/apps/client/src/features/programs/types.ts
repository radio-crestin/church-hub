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
 * Program from API
 */
export interface Program {
  id: number
  name: string
  description: string | null
  createdAt: number
  updatedAt: number
}

/**
 * Slide from API
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
 * Program with slides from API
 */
export interface ProgramWithSlides extends Program {
  slides: Slide[]
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
 * Default slide content
 */
export function getDefaultSlideContent(): SlideContent {
  return {
    type: 'custom',
    html: '',
    textAlign: 'center',
    verticalAlign: 'center',
    autoFitText: true,
  }
}
