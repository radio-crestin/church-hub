import { getApiUrl } from '~/config'

const DEBUG = import.meta.env.DEV

function log(level: 'debug' | 'info' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [highlight-colors-service] ${message}`)
}

export interface HighlightColor {
  id: number
  name: string
  color: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface UpsertHighlightColorInput {
  id?: number
  name: string
  color: string
  sortOrder?: number
}

export interface ReorderHighlightColorsInput {
  colorIds: number[]
}

/**
 * Fetches all highlight colors
 */
export async function getAllHighlightColors(): Promise<HighlightColor[]> {
  log('debug', 'Fetching all highlight colors')

  const response = await fetch(`${getApiUrl()}/api/highlight-colors`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch highlight colors')
  }

  const result = await response.json()
  return result.data
}

/**
 * Creates or updates a highlight color
 */
export async function upsertHighlightColor(
  input: UpsertHighlightColorInput,
): Promise<HighlightColor> {
  log('debug', `Upserting highlight color: ${input.name}`)

  const response = await fetch(`${getApiUrl()}/api/highlight-colors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to save highlight color')
  }

  const result = await response.json()
  return result.data
}

/**
 * Deletes a highlight color
 */
export async function deleteHighlightColor(id: number): Promise<void> {
  log('debug', `Deleting highlight color: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/highlight-colors/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to delete highlight color')
  }
}

/**
 * Reorders highlight colors
 */
export async function reorderHighlightColors(
  input: ReorderHighlightColorsInput,
): Promise<void> {
  log('debug', `Reordering ${input.colorIds.length} highlight colors`)

  const response = await fetch(`${getApiUrl()}/api/highlight-colors/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to reorder highlight colors')
  }
}
