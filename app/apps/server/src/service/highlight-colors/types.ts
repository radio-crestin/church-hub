/**
 * Highlight color API response format
 */
export interface HighlightColor {
  id: number
  name: string
  color: string
  textColor: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

/**
 * Input for creating/updating a highlight color
 */
export interface UpsertHighlightColorInput {
  id?: number
  name: string
  color: string
  textColor?: string
  sortOrder?: number
}

/**
 * Input for reordering highlight colors
 */
export interface ReorderHighlightColorsInput {
  colorIds: number[]
}

/**
 * Result of a database operation
 */
export interface OperationResult {
  success: boolean
  error?: string
}
