import { getApiUrl } from '~/config'
import type {
  Display,
  DisplayTheme,
  NavigateInput,
  PresentationState,
  UpdatePresentationStateInput,
  UpsertDisplayInput,
} from '../types'

const DEBUG = import.meta.env.DEV

function log(level: 'debug' | 'info' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [displays-service] ${message}`)
}

/**
 * Fetches all displays
 */
export async function getAllDisplays(): Promise<Display[]> {
  log('debug', 'Fetching all displays')

  const response = await fetch(`${getApiUrl()}/api/displays`)

  if (!response.ok) {
    throw new Error('Failed to fetch displays')
  }

  return response.json()
}

/**
 * Fetches a display by ID
 */
export async function getDisplayById(id: number): Promise<Display> {
  log('debug', `Fetching display: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/displays/${id}`)

  if (!response.ok) {
    throw new Error('Failed to fetch display')
  }

  return response.json()
}

/**
 * Creates or updates a display
 */
export async function upsertDisplay(
  input: UpsertDisplayInput,
): Promise<Display> {
  log('debug', `Upserting display: ${input.name}`)

  const response = await fetch(`${getApiUrl()}/api/displays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to save display')
  }

  return response.json()
}

/**
 * Deletes a display
 */
export async function deleteDisplay(id: number): Promise<void> {
  log('debug', `Deleting display: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/displays/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Failed to delete display')
  }
}

/**
 * Updates a display's theme
 */
export async function updateDisplayTheme(
  id: number,
  theme: DisplayTheme,
): Promise<void> {
  log('debug', `Updating display theme: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/displays/${id}/theme`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theme),
  })

  if (!response.ok) {
    throw new Error('Failed to update display theme')
  }
}

/**
 * Fetches presentation state
 */
export async function getPresentationState(): Promise<PresentationState> {
  log('debug', 'Fetching presentation state')

  const response = await fetch(`${getApiUrl()}/api/presentation/state`)

  if (!response.ok) {
    throw new Error('Failed to fetch presentation state')
  }

  return response.json()
}

/**
 * Updates presentation state
 */
export async function updatePresentationState(
  input: UpdatePresentationStateInput,
): Promise<PresentationState> {
  log('debug', 'Updating presentation state')

  const response = await fetch(`${getApiUrl()}/api/presentation/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to update presentation state')
  }

  return response.json()
}

/**
 * Navigates slides
 */
export async function navigateSlide(
  input: NavigateInput,
): Promise<PresentationState> {
  log('debug', `Navigating: ${input.direction}`)

  const response = await fetch(`${getApiUrl()}/api/presentation/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('Failed to navigate')
  }

  return response.json()
}

/**
 * Starts a presentation
 */
export async function startPresentation(
  programId: number,
): Promise<PresentationState> {
  log('debug', `Starting presentation: ${programId}`)

  const response = await fetch(`${getApiUrl()}/api/presentation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programId }),
  })

  if (!response.ok) {
    throw new Error('Failed to start presentation')
  }

  return response.json()
}

/**
 * Stops the current presentation
 */
export async function stopPresentation(): Promise<PresentationState> {
  log('debug', 'Stopping presentation')

  const response = await fetch(`${getApiUrl()}/api/presentation/stop`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Failed to stop presentation')
  }

  return response.json()
}

/**
 * Clears the current slide
 */
export async function clearSlide(): Promise<PresentationState> {
  log('debug', 'Clearing slide')

  const response = await fetch(`${getApiUrl()}/api/presentation/clear`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Failed to clear slide')
  }

  return response.json()
}
