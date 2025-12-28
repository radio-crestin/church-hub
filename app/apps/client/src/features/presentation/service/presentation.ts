import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import type {
  PresentationState,
  PresentTemporaryBibleInput,
  PresentTemporarySongInput,
  UpdatePresentationStateInput,
} from '../types'

// Check if we're running in Tauri context
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// Use Tauri fetch on mobile (iOS WKWebView blocks HTTP fetch)
const fetchFn = isTauri && isMobile() ? tauriFetch : window.fetch.bind(window)

// Get headers with auth token for mobile
function getHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  // Add auth cookie header for mobile (Tauri HTTP plugin needs explicit Cookie header)
  if (isMobile()) {
    const userToken = getStoredUserToken()
    if (userToken) {
      headers['Cookie'] = `user_auth=${userToken}`
    }
  }
  return headers
}

/**
 * Fetches the current presentation state
 */
export async function getPresentationState(): Promise<PresentationState> {
  const response = await fetchFn(`${getApiUrl()}/api/presentation/state`, {
    credentials: 'include',
    headers: getHeaders(),
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
  const response = await fetchFn(`${getApiUrl()}/api/presentation/state`, {
    method: 'PUT',
    headers: getHeaders('application/json'),
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
  const response = await fetchFn(`${getApiUrl()}/api/presentation/stop`, {
    method: 'POST',
    headers: getHeaders(),
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
  const response = await fetchFn(`${getApiUrl()}/api/presentation/clear`, {
    method: 'POST',
    headers: getHeaders(),
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
  const response = await fetchFn(`${getApiUrl()}/api/presentation/show`, {
    method: 'POST',
    headers: getHeaders(),
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
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/navigate-queue`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
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
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-bible`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
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
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/temporary-song`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
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
 * Includes timestamp to prevent race conditions when navigating rapidly
 */
export async function navigateTemporary(input: {
  direction: 'next' | 'prev'
  requestTimestamp: number
}): Promise<PresentationState> {
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/navigate-temporary`,
    {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        direction: input.direction,
        requestTimestamp: input.requestTimestamp,
      }),
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
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/clear-temporary`,
    {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to clear temporary content')
  }

  const result = await response.json()
  return result.data
}
