import { getApiUrl } from '~/config'
import type {
  Display,
  DisplayTheme,
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

  const response = await fetch(`${getApiUrl()}/api/displays`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch displays')
  }

  const result = await response.json()
  return result.data
}

/**
 * Fetches a display by ID
 */
export async function getDisplayById(id: number): Promise<Display> {
  log('debug', `Fetching display: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/displays/${id}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch display')
  }

  const result = await response.json()
  return result.data
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
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to save display')
  }

  const result = await response.json()
  return result.data
}

/**
 * Deletes a display
 */
export async function deleteDisplay(id: number): Promise<void> {
  log('debug', `Deleting display: ${id}`)

  const response = await fetch(`${getApiUrl()}/api/displays/${id}`, {
    method: 'DELETE',
    credentials: 'include',
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
    body: JSON.stringify({ theme }),
    credentials: 'include',
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

  const response = await fetch(`${getApiUrl()}/api/presentation/state`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch presentation state')
  }

  const result = await response.json()
  return result.data
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
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to update presentation state')
  }

  const result = await response.json()
  return result.data
}

/**
 * Stops the current presentation
 */
export async function stopPresentation(): Promise<PresentationState> {
  log('debug', 'Stopping presentation')

  const response = await fetch(`${getApiUrl()}/api/presentation/stop`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to stop presentation')
  }

  const result = await response.json()
  return result.data
}

/**
 * Clears the current slide (hides it)
 */
export async function clearSlide(): Promise<PresentationState> {
  log('debug', 'Clearing slide')

  const response = await fetch(`${getApiUrl()}/api/presentation/clear`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to clear slide')
  }

  const result = await response.json()
  return result.data
}

/**
 * Shows the last displayed slide (restores from hidden state)
 */
export async function showSlide(): Promise<PresentationState> {
  log('debug', 'Showing last slide')

  const response = await fetch(`${getApiUrl()}/api/presentation/show`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to show slide')
  }

  const result = await response.json()
  return result.data
}

/**
 * Navigates to next or previous slide in the queue
 */
export async function navigateQueueSlide(
  direction: 'next' | 'prev',
): Promise<PresentationState> {
  log('debug', `Navigating queue: ${direction}`)

  const response = await fetch(
    `${getApiUrl()}/api/presentation/navigate-queue`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to navigate queue')
  }

  const result = await response.json()
  return result.data
}
