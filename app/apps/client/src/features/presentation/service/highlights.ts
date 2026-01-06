import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { getApiUrl, isMobile } from '~/config'
import { getStoredUserToken } from '~/service/api-url'
import type { TextStyleRange } from '../types'

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
 * Fetches the current slide highlights
 */
export async function getSlideHighlights(): Promise<TextStyleRange[]> {
  const response = await fetchFn(`${getApiUrl()}/api/presentation/highlights`, {
    credentials: 'include',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch slide highlights')
  }

  const result = await response.json()
  return result.data
}

/**
 * Adds a highlight to the current slide
 */
export async function addSlideHighlight(
  highlight: TextStyleRange,
): Promise<TextStyleRange[]> {
  const response = await fetchFn(`${getApiUrl()}/api/presentation/highlights`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify(highlight),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to add slide highlight')
  }

  const result = await response.json()
  return result.data
}

/**
 * Removes a specific highlight by ID
 */
export async function removeSlideHighlight(
  highlightId: string,
): Promise<TextStyleRange[]> {
  const response = await fetchFn(
    `${getApiUrl()}/api/presentation/highlights/${highlightId}`,
    {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    },
  )

  if (!response.ok) {
    throw new Error('Failed to remove slide highlight')
  }

  const result = await response.json()
  return result.data
}

/**
 * Clears all slide highlights
 */
export async function clearSlideHighlights(): Promise<TextStyleRange[]> {
  const response = await fetchFn(`${getApiUrl()}/api/presentation/highlights`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to clear slide highlights')
  }

  const result = await response.json()
  return result.data
}
