import { getApiUrl } from '~/config'
import type {
  PresentationState,
  PresentTemporaryBibleInput,
  PresentTemporarySongInput,
  UpdatePresentationStateInput,
} from '../types'

/**
 * Fetches the current presentation state
 */
export async function getPresentationState(): Promise<PresentationState> {
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
 * Updates the presentation state
 */
export async function updatePresentationState(
  input: UpdatePresentationStateInput,
): Promise<PresentationState> {
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
 * Clears/hides the current slide
 */
export async function clearSlide(): Promise<PresentationState> {
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
 * Shows the last displayed slide
 */
export async function showSlide(): Promise<PresentationState> {
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
 * Navigates to next/previous queue item
 */
export async function navigateQueueSlide(
  direction: 'next' | 'prev',
): Promise<PresentationState> {
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

// ============================================================================
// TEMPORARY CONTENT FUNCTIONS (bypasses queue for instant display)
// ============================================================================

/**
 * Present a Bible verse temporarily (bypasses queue)
 */
export async function presentTemporaryBible(
  input: PresentTemporaryBibleInput,
): Promise<PresentationState> {
  const response = await fetch(
    `${getApiUrl()}/api/presentation/temporary-bible`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to present temporary Bible verse')
  }

  const result = await response.json()
  return result.data
}

/**
 * Present a song temporarily (bypasses queue)
 */
export async function presentTemporarySong(
  input: PresentTemporarySongInput,
): Promise<PresentationState> {
  const response = await fetch(
    `${getApiUrl()}/api/presentation/temporary-song`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to present temporary song')
  }

  const result = await response.json()
  return result.data
}

/**
 * Navigate within temporary content (next/prev)
 */
export async function navigateTemporary(input: {
  direction: 'next' | 'prev'
}): Promise<PresentationState> {
  const response = await fetch(
    `${getApiUrl()}/api/presentation/navigate-temporary`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: input.direction }),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to navigate temporary content')
  }

  const result = await response.json()
  return result.data
}

/**
 * Clear temporary content
 */
export async function clearTemporaryContent(): Promise<PresentationState> {
  const response = await fetch(
    `${getApiUrl()}/api/presentation/clear-temporary`,
    {
      method: 'POST',
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to clear temporary content')
  }

  const result = await response.json()
  return result.data
}
